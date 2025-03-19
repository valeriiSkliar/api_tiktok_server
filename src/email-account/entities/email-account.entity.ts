export class EmailAccount {}

export class Email {
  id: number;
  email_address: string;
  provider: string;
  connection_details?: Record<string, any>;
  username: string;
  password: string;
  status: string;
  last_check_timestamp?: Date;
  is_associated: boolean;
  created_at: Date;
  updated_at: Date;

  // Relations
  activities?: any[];
  tiktok_account?: any[];
  verification_codes?: any[];
}
