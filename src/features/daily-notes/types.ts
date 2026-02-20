export interface DailyNotesSettings {
  folder: string;
  dateFormat: string;
  template: string;
}

const DEFAULT_TEMPLATE = `# {{date}}

## 오늘의 할 일
- [ ]

## 메모

`;

export const DEFAULT_DAILY_NOTES_SETTINGS: DailyNotesSettings = {
  folder: "데일리",
  dateFormat: "yyyy-MM-dd",
  template: DEFAULT_TEMPLATE,
};

export type DailyNotesMap = Map<string, string>;
