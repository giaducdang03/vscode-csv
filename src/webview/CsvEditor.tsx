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
      </div>

      <div className="grid-wrapper ag-theme-alpine-dark">
        <AgGridReact
          cellSelection={true}
          rowData={rowData}
          columnDefs={columnDefs}
          suppressCellFocus={true}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          onCellValueChanged={(params: any) => {
            const updatedRows = [...rowData];
            updatedRows[params.rowIndex][params.colDef.field!] =
              params.newValue;
            setRowData(updatedRows);
          }}
        />
      </div>
    </div>
  );
};

export default CsvEditor;
