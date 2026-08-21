export type TAdminEmployee = {
  id: string;
  name: string;
  email: string;
};

export type TAdminAuditConversation = {
  conversationId: string;
  title: string;
  employee: TAdminEmployee;
  preview: string;
  messageCount: number;
  fileCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TAdminAuditPage = {
  conversations: TAdminAuditConversation[];
  total: number;
  limit: number;
  offset: number;
};

export type TAdminAuditMessage = {
  messageId: string;
  sender: string;
  text: string;
  isCreatedByUser: boolean;
  createdAt?: string;
};

export type TAdminAuditFile = {
  fileId: string;
  filename: string;
  type: string;
  bytes: number;
  createdAt?: string;
};

export type TAdminConversationDetail = {
  conversationId: string;
  title: string;
  employee: TAdminEmployee;
  createdAt?: string;
  updatedAt?: string;
  messages: TAdminAuditMessage[];
  files: TAdminAuditFile[];
  messageTotal: number;
  limit: number;
  offset: number;
};

export type TAdminUsageFilters = {
  employeeId?: string;
  email?: string;
  from?: string;
  to?: string;
  files?: 'with' | 'without';
  q?: string;
  limit?: number;
  offset?: number;
};

export type TAdminDailyUsage = {
  date: string;
  messages: number;
  conversations: number;
  activeUsers: number;
};

export type TAdminUsageStatistics = {
  registeredUsers: number;
  activeUsersToday: number;
  activeUsers7Days: number;
  activeUsers30Days: number;
  conversationsToday: number;
  conversations7Days: number;
  conversations30Days: number;
  messagesToday: number;
  messages7Days: number;
  messages30Days: number;
  conversationsWithFiles: number;
  totalUploadedFiles: number;
  rangeDays: 7 | 30 | 90;
  daily: TAdminDailyUsage[];
};

export type TAdminEmployeesPage = {
  employees: TAdminEmployee[];
  total: number;
  limit: number;
  offset: number;
};
