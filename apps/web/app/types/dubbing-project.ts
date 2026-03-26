import type {
  DubbingProjectStatus,
  PaymentType,
  ValueCurrency,
} from "@/app/(private)/projetos/domain";

/** Projeto serializado na API (Decimal → string). Tipos partilhados entre API e UI. */
export type DubbingProjectDto = {
  id: string;
  name: string;
  client: string | null;
  clientId: string | null;
  status: DubbingProjectStatus;
  startDate: string | null;
  deadline: string | null;
  episodes: number | null;
  durationMin: number | null;
  language: string | null;
  value: string | null;
  valueCurrency: ValueCurrency;
  paymentType: PaymentType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
};
