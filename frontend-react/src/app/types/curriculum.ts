export interface Lecture {
  id: string;
  title: string;
  source: string;
  keywords: string[];
}

export interface Module {
  id: string;
  title: string;
  lectures: Lecture[];
}

export interface GeneratedCourse {
  id: string;
  title: string;
  sourceLabel: string;
  modules: Module[];
}
