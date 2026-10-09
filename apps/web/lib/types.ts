export type MilestoneStatus = "pending" | "submitted" | "verified" | "rejected";

export interface Evidence {
  fileName: string;
  cid: string;
  hash: string;
  note: string;
  uploadedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO
  weightBps: number; // porsi pencairan dana, total 10000
  status: MilestoneStatus;
  evidence?: Evidence;
  /** saldo token saat bukti diunggah, dipakai sebagai bobot suara */
  snapshot?: Record<string, number>;
  yes: number;
  no: number;
  voted: Record<string, boolean>;
}

export interface OwnerProfile {
  bio: string;
  location: string;
  specs: string[];
  portfolio: { title: string; result: string; year: number }[];
}

export interface Trade {
  t: string;
  price: number;
}

export interface Effort {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  summary: string;
  target: string;
  totalValue: number;
  maxYield: number;
  tokenSupply: number;
  sold: number;
  saleDeadline: string;
  createdAt: string;
  milestones: Milestone[];
  profile: OwnerProfile;
  trades: Trade[];
  /** total pendapatan penjualan yang disetor pemilik */
  revenueGross?: number;
  /** bagian yang dibagikan ke pemegang token (dibatasi max yield) */
  payoutPool?: number;
  refunded: Record<string, boolean>;
  claimed: Record<string, boolean>;
}

export interface Listing {
  id: string;
  effortId: string;
  seller: string;
  amount: number;
  price: number;
  active: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: "Pemilik effort" | "Investor";
  balance: number;
}

export interface State {
  users: Record<string, User>;
  efforts: Effort[];
  listings: Listing[];
  holdings: Record<string, Record<string, number>>;
  me: string;
}

export type Phase = "selling" | "running" | "completed" | "failed";
