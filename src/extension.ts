// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { join } from "path";
import * as vscode from "vscode";
import { ExtensionContext, ExtensionMode, Uri, Webview } from "vscode";
import { MessageHandlerData } from "@estruyf/vscode";
import { readFileSync, writeFileSync } from "fs";

class CsvEditorViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'csvEditorView';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { padding: 15px; }
            button, select { 
              width: 100%;
              margin-bottom: 10px;
              padding: 8px;
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              cursor: pointer;
            }
            select {
              background: var(--vscode-dropdown-background);
              color: var(--vscode-dropdown-foreground);
              margin-bottom: 5px;
            }
            button:hover {
              background: var(--vscode-button-hoverBackground);
            }
          </style>
        </head>
        <body>
          <select id="templateSelect">
            <option value="empty">Empty Template</option>
            <option value="contacts">Contacts Template</option>
            <option value="inventory">Inventory Template</option>
          </select>
          <button id="createNew">Create New CSV</button>
          <button id="openEditor">Open CSV Editor</button>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('createNew').addEventListener('click', () => {
              const template = document.getElementById('templateSelect').value;
              vscode.postMessage({ command: 'createFromTemplate', template });
            });
            document.getElementById('openEditor').addEventListener('click', () => {
              vscode.postMessage({ command: 'openEditor' });
            });
          </script>
        </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'openEditor') {
        vscode.commands.executeCommand('vscode-react-webview-csv-editor.openCsvEditor');
      } else if (message.command === 'createFromTemplate') {
        const templatePath = join(this._extensionUri.fsPath, 'templates', `${message.template}.csv`);
        try {
          const templateContent = readFileSync(templatePath, 'utf-8');
          const newFileUri = await vscode.window.showSaveDialog({
            filters: { 'CSV Files': ['csv'] },
            defaultUri: Uri.file('new.csv')
          });

          if (newFileUri) {
            const data = new TextEncoder().encode(templateContent);
            await vscode.workspace.fs.writeFile(newFileUri, data);
            
            // Open the file in VSCode editor first
            await vscode.window.showTextDocument(newFileUri);
            
            // Then open in CSV Editor
            vscode.commands.executeCommand('vscode-react-webview-csv-editor.openCsvEditor');
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error creating file from template: ${error}`);
        }
      }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Register view provider
  const provider = new CsvEditorViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CsvEditorViewProvider.viewType, provider)
  );

  let currentFileUri: Uri | undefined;

  let disposable = vscode.commands.registerCommand(
    "vscode-react-webview-csv-editor.openCsvEditor",
    async () => {
      // Get active document if it's a CSV file
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor?.document.uri.fsPath.endsWith('.csv')) {
        currentFileUri = activeEditor.document.uri;
      } else {
        vscode.window.showErrorMessage('Please open a CSV file first');
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "react-webview",
        currentFileUri ? `CSV: ${currentFileUri.fsPath}` : "CSV Editor",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.onDidReceiveMessage(
        async (message) => {
          const { command, requestId, payload } = message;

          if (command === "SAVE_CSV") {
            try {
              if (currentFileUri) {
                // Convert string to Uint8Array for writing
                const data = new TextEncoder().encode(payload);
                await vscode.workspace.fs.writeFile(currentFileUri, data);
                vscode.window.showInformationMessage('CSV file saved successfully');
                panel.webview.postMessage({
                  command,
                  requestId,
                  payload: "File saved successfully"
                } as MessageHandlerData<string>);
              } else {
                // If no current file, show save dialog
                const fileUri = await vscode.window.showSaveDialog({
                  filters: { 'CSV Files': ['csv'] },
                  defaultUri: Uri.file('data.csv')
                });

                if (fileUri) {
                  const data = new TextEncoder().encode(payload);
                  await vscode.workspace.fs.writeFile(fileUri, data);
                  currentFileUri = fileUri;
                  panel.title = `CSV: ${fileUri.fsPath}`;
                  vscode.window.showInformationMessage('CSV file saved successfully');
                  panel.webview.postMessage({
                    command,
                    requestId,
                    payload: "File saved successfully"
                  } as MessageHandlerData<string>);
                }
              }
            } catch (error: any) {
              panel.webview.postMessage({
                command,
                requestId,
                error: `Error saving CSV: ${error.message}`
              } as MessageHandlerData<string>);
            }
          } else if (command === "LOAD_CSV" || command === "GET_CSV_CONTENT") {
            try {
              let fileUri: Uri | undefined;
              
              if (command === "GET_CSV_CONTENT" && currentFileUri) {
                fileUri = currentFileUri;
              } else {
                const result = await vscode.window.showOpenDialog({
                  canSelectFiles: true,
                  canSelectMany: false,
                  filters: { 'CSV Files': ['csv'] }
                });
                fileUri = result?.[0];
                if (fileUri) currentFileUri = fileUri;
              }

              if (fileUri) {
                const fileContent = readFileSync(fileUri.fsPath, 'utf-8');
                panel.title = `CSV: ${fileUri.fsPath}`;
                panel.webview.postMessage({
                  command,
                  requestId,
                  payload: fileContent
                } as MessageHandlerData<string>);
              }
            } catch (error: any) {
              panel.webview.postMessage({
                command,
                requestId,
                error: `Error loading CSV: ${error.message}`
              } as MessageHandlerData<string>);
            }
          }
        },
        undefined,
        context.subscriptions
      );

      // If we have a current file, load it immediately
      if (currentFileUri) {
        const fileContent = readFileSync(currentFileUri.fsPath, 'utf-8');
        panel.webview.postMessage({
          command: 'GET_CSV_CONTENT',
          payload: fileContent
        } as MessageHandlerData<string>);
      }

      panel.webview.html = getWebviewContent(context, panel.webview);
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

const getWebviewContent = (context: ExtensionContext, webview: Webview) => {
  const jsFile = "main.bundle.js";
  const localServerUrl = "http://localhost:9000";

  let scriptUrl = [];
  let cssUrl = null;

  const isProduction = context.extensionMode === ExtensionMode.Production;
  if (isProduction) {
    // Get the manifest file from the dist folder
    const manifest = readFileSync(
      join(context.extensionPath, "dist", "webview", "manifest.json"),
      "utf-8"
    );
    const manifestJson = JSON.parse(manifest);
    for (const [key, value] of Object.entries<string>(manifestJson)) {
      if (key.endsWith(".js")) {
        scriptUrl.push(
          webview
            .asWebviewUri(
              Uri.file(join(context.extensionPath, "dist", "webview", value))
            )
            .toString()
        );
      }
    }
  } else {
    scriptUrl.push(`${localServerUrl}/${jsFile}`);
  }

  return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		${isProduction ? `<link href="${cssUrl}" rel="stylesheet">` : ""}
	</head>
	<body>
		<div id="root"></div>

		${scriptUrl.map((url) => `<script src="${url}"></script>`).join("\n")}
	</body>
	</html>`;
};
