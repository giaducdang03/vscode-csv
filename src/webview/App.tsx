import * as React from 'react';
import { messageHandler } from '@estruyf/vscode/dist/client';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import "./styles.css";
import Papa from 'papaparse';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

export interface IAppProps {}

interface RowData {
  [key: string]: string | number;
}

export const App: React.FunctionComponent<IAppProps> = ({ }: React.PropsWithChildren<IAppProps>) => {
  const [rowData, setRowData] = React.useState<RowData[]>([
    { col0: '', col1: 'Tesla', col2: 'Volvo', col3: 'Toyota', col4: 'Ford' },
    { col0: '2019', col1: 10, col2: 11, col3: 12, col4: 13 },
    { col0: '2020', col1: 20, col2: 11, col3: 14, col4: 13 },
    { col0: '2021', col1: 30, col2: 15, col3: 12, col4: 13 }
  ]);

  const [columnDefs, setColumnDefs] = React.useState<ColDef[]>([
    { field: 'col0', headerName: '', editable: true },
    { field: 'col1', headerName: 'Tesla', editable: true  },
    { field: 'col2', headerName: 'Volvo', editable: true  },
    { field: 'col3', headerName: 'Toyota', editable: true  },
    { field: 'col4', headerName: 'Ford', editable: true }
  ]);

  const handleLoadCsv = () => {
    messageHandler.request<string>('GET_CSV_CONTENT')
      .then((csvContent) => {
        Papa.parse(csvContent, {
          complete: (results) => {
            const headers = results.data[0] as string[];
            const rows = results.data.slice(1).map(row => {
              const obj: RowData = {};
              (row as string[]).forEach((cell, i) => {
                obj[`col${i}`] = isNaN(Number(cell)) ? cell : Number(cell);
              });
              return obj;
            });
            
            const newColDefs: ColDef[] = headers.map((header, index) => ({
              field: `col${index}`,
              headerName: header,
              editable: true
            }));
            setColumnDefs(newColDefs);
            setRowData(rows);
          },
          error: (error: any) => {
            console.error('Error parsing CSV:', error);
          }
        });
      })
      .catch((err) => {
        console.error('Error loading CSV:', err);
      });
  };

  const handleAddRow = () => {
    const newRow: RowData = {};
    columnDefs.forEach((col) => {
      newRow[col.field!] = '';
    });
    setRowData([...rowData, newRow]);
  };

  const handleAddColumn = () => {
    const newField = `col${columnDefs.length}`;
    const newColDef: ColDef = {
      field: newField,
      headerName: `Column ${columnDefs.length}`,
      editable: true
    };
    
    // Add new column to existing rows
    const updatedRows = rowData.map(row => ({
      ...row,
      [newField]: ''
    }));

    setColumnDefs([...columnDefs, newColDef]);
    setRowData(updatedRows);
  };

  const handleSave = () => {
    // Convert data back to CSV
    const headers = columnDefs.map(col => col.headerName || '');
    const rows = rowData.map(row => 
      columnDefs.map(col => row[col.field!].toString())
    );
    
    const csvContent = Papa.unparse([headers, ...rows]);
    
    messageHandler.request<string>('SAVE_CSV', csvContent)
      .then((response) => {
        console.log('File saved:', response);
      })
      .catch((err) => {
        console.error('Error saving file:', err);
      });
  };

  return (
    <div className='app'>
      <h1>CSV Viewer</h1>

      <div className='app__actions'>
        <button onClick={handleLoadCsv}>Load CSV</button>
        <button onClick={handleSave}>Save CSV</button>
        <button onClick={handleAddRow}>Add Row</button>
        <button onClick={handleAddColumn}>Add Column</button>
      </div>

      <div className="grid-wrapper ag-theme-alpine-dark">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          suppressCellFocus={true}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true
          }}
          onCellValueChanged={(params: any) => {
            // Update rowData when cell is edited
            const updatedRows = [...rowData];
            updatedRows[params.rowIndex][params.colDef.field!] = params.newValue;
            setRowData(updatedRows);
          }}
        />
      </div>
    </div>
  );
};