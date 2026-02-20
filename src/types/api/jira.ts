export interface JiraTestRequest {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraUserProfile {
  displayName: string;
  emailAddress?: string;
  accountId?: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraTestResponse {
  profile: JiraUserProfile;
}

export interface JiraIssuesRequest {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  updated?: string;
  assignee?: string;
}

export interface JiraIssuesResponse {
  issues: JiraIssue[];
}
