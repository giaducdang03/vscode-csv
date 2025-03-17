import * as React from "react";
import { messageHandler } from "@estruyf/vscode/dist/client";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import Papa from "papaparse";

interface RowData {
  [key: string]: string | number;
}

const CsvEditor: React.FC = () => {
  const [rowData, setRowData] = React.useState<RowData[]>([]);
  const [columnDefs, setColumnDefs] = React.useState<ColDef[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<number[]>([]);
  const [selectedCols, setSelectedCols] = React.useState<string[]>([]);
  const [template, setTemplate] = React.useState('empty');

  const handleLoadCsv = () => {
    messageHandler.request<string>("GET_CSV_CONTENT").then((csvContent) => {
      Papa.parse(csvContent, {
        complete: (results) => {
          const headers = results.data[0] as string[];
          const rows = results.data.slice(1).map((row) => {
            const obj: RowData = {};
            (row as string[]).forEach((cell, i) => {
              obj[`col${i}`] = cell ? cell : cell;
            });
            return obj;
          });

          const newColDefs: ColDef[] = headers.map((header, index) => ({
            field: `col${index}`,
            headerName: header,
            editable: true,
          }));
          setColumnDefs(newColDefs);
          setRowData(rows);
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
        },
      });
    });
  };

  const handleTemplateLoad = () => {
    messageHandler.request<string>('CREATE_FROM_TEMPLATE', template)
      .then((csvContent) => {
        if (csvContent) {
          Papa.parse(csvContent, {
            complete: (results) => {
              const headers = results.data[0] as string[];
              const rows = results.data.slice(1).map((row) => {
                const obj: RowData = {};
                (row as string[]).forEach((cell, i) => {
                  obj[`col${i}`] = cell ? cell : cell;
                });
                return obj;
              });
              
              const newColDefs: ColDef[] = headers.map((header, index) => ({
                field: `col${index}`,
                headerName: header,
                editable: true,
              }));
              setColumnDefs(newColDefs);
              setRowData(rows);
            }
          });
        }
      });
  };

  const handleAddRow = () => {
    const newRow: RowData = {};
    columnDefs.forEach((col) => {
      newRow[col.field!] = "";
    });
    setRowData([...rowData, newRow]);
  };

  const handleAddColumn = () => {
    const newField = `col${columnDefs.length}`;
    const newColDef: ColDef = {
      field: newField,
      headerName: `Column ${columnDefs.length}`,
      editable: true,
    };

    const updatedRows = rowData.map((row) => ({
      ...row,
      [newField]: "",
    }));

    setColumnDefs([...columnDefs, newColDef]);
    setRowData(updatedRows);
  };

  const handleDeleteRows = () => {
    if (selectedRows.length === 0) return;
    const newRowData = rowData.filter(
      (_, index) => !selectedRows.includes(index)
    );
    setRowData(newRowData);
    setSelectedRows([]);
  };

  const handleDeleteColumns = () => {
    if (selectedCols.length === 0) return;
    const newColumnDefs = columnDefs.filter(
      (col) => !selectedCols.includes(col.field!)
    );
    const newRowData = rowData.map((row) => {
      const newRow = { ...row };
      selectedCols.forEach((field) => delete newRow[field]);
      return newRow;
    });

    setColumnDefs(newColumnDefs);
    setRowData(newRowData);
    setSelectedCols([]);
  };

  const handleSave = () => {
    const headers = columnDefs.map((col) => col.headerName || "");
    const rows = rowData.map((row) =>
      columnDefs.map((col) => row[col.field!].toString())
    );

    const csvContent = Papa.unparse([headers, ...rows]);

    messageHandler.request<string>("SAVE_CSV", csvContent).then((response) => {
      console.log("File saved:", response);
    });
  };

  return (
    <div>
      <div className="app__actions">
        <button onClick={handleLoadCsv}>Load CSV</button>
        <button onClick={handleSave}>Save CSV</button>
        <button onClick={handleAddRow}>Add Row</button>
        <button onClick={handleAddColumn}>Add Column</button>
        <button onClick={handleDeleteRows} disabled={selectedRows.length === 0}>
          Delete Rows
        </button>
        <button onClick={handleDeleteColumns} disabled={selectedCols.length === 0}>
          Delete Columns
        </button>
      </div>

      <div className="grid-wrapper ag-theme-alpine-dark">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          suppressCellFocus={true}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onSelectionChanged={(event: any) => {
            const selected = event.api
              .getSelectedNodes()
              .map((node: any) => node.rowIndex);
            setSelectedRows(selected);
          }}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            checkboxSelection: true,
            cellStyle: {
              backgroundColor: 'var(--vscode-editor-background)',
              color: 'var(--vscode-editor-foreground)',
            },
          }}
          headerHeight={32}
          rowHeight={25}
          rowStyle={{
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
            borderColor: 'var(--vscode-editor-lineHighlightBorder)',
          }}
          getRowStyle={(params: any) => ({
            backgroundColor: params.node.isSelected() 
              ? 'var(--vscode-editor-selectionBackground)'
              : params.node.rowIndex % 2 === 0 
                ? 'var(--vscode-editor-background)' 
                : 'var(--vscode-editor-inactiveSelectionBackground)',
          })}
        />
      </div>
    </div>
  );
};

export default CsvEditor;
