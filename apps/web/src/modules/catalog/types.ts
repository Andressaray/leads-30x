export interface Category {
  key: string;
  name: string;
}

export interface Department {
  code: string;
  name: string;
}

export interface Municipality {
  code: string;
  name: string;
  department: string;
  departmentCode: string;
}
