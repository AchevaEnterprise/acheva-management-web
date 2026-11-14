export type ManagementOffice = 'DVC' | 'EXAMS_RECORDS';

/** The signed-in account, as `/auth/management/login` and `/me` return it. */
export interface IManagementAccount {
  id: string;
  email: string;
  titles: string[];
  firstname: string;
  lastname: string;
  accountType: 'MANAGEMENT';
  office: ManagementOffice;
  isTeamHead: boolean;
  /** "DVC" · "Head, Exams & Records" · "Exams & Records" */
  officeTitle: string;
  school: { _id: string; name: string; acronym: string } | null;
}

export interface IInviteInfo {
  email: string;
  office: ManagementOffice;
  isTeamHead: boolean;
  officeTitle: string;
  school: { _id: string; name: string; acronym: string };
  expiresAt: string;
}

export interface ITeamMember {
  _id: string;
  titles?: string[];
  firstname: string;
  lastname: string;
  email: string;
  isTeamHead: boolean;
  isActive: boolean;
  officeTitle: string;
  createdAt: string;
}

export interface IPendingInvite {
  _id: string;
  email: string;
  officeTitle: string;
  expiresAt: string;
  createdAt: string;
}

export interface ICreatedInvite {
  _id: string;
  email: string;
  officeTitle: string;
  expiresAt: string;
  inviteLink: string;
}

export interface INotification {
  _id: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  createdAt: string;
  meta?: { type?: string; submissionId?: string } | null;
}
