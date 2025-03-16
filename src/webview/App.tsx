import * as React from 'react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import "./styles.css";
import CsvEditor from './CsvEditor';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface IAppProps {}

export const App: React.FunctionComponent<IAppProps> = () => {
  return (
    <div className='app'>
      <h1>CSV Viewer</h1>
      <CsvEditor />
    </div>
  );
};