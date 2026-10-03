export interface SupersetConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface SupersetDataset {
  id: number;
  table_name: string;
  [key: string]: any;
}
