import type { CommunicationChannel } from "@/app/types/communication-log";

const LABELS: Record<CommunicationChannel, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SYSTEM: "Sistema",
};

export function communicationChannelLabel(channel: CommunicationChannel): string {
  return LABELS[channel];
}

/** Classes de borda/fundo/texto alinhadas à lista de comunicação do projeto. */
export function communicationChannelChipClass(channel: CommunicationChannel): string {
  switch (channel) {
    case "EMAIL":
      return "border-[#315d7a] bg-[#1a3144] text-[#a7d8f0]";
    case "WHATSAPP":
      return "border-[#1d7043] bg-[#173626] text-[#72d89a]";
    default:
      return "border-[#4a4a4a] bg-[#2a2a2a] text-[#bdbdbd]";
  }
}

const chipBase =
  "inline-flex items-center rounded-full border px-[7px] py-[2px] text-[9px] font-[600]";

type CommunicationChannelChipProps = {
  channel: CommunicationChannel;
  className?: string;
};

export function CommunicationChannelChip({
  channel,
  className = "",
}: CommunicationChannelChipProps) {
  return (
    <span className={`${chipBase} ${communicationChannelChipClass(channel)} ${className}`.trim()}>
      {communicationChannelLabel(channel)}
    </span>
  );
}

type CommunicationChannelChipRowProps = {
  channels: CommunicationChannel[];
  /** Quando não há canais, exibe esta mensagem (texto simples). */
  emptyMessage?: string | null;
  className?: string;
};

export function CommunicationChannelChipRow({
  channels,
  emptyMessage,
  className = "",
}: CommunicationChannelChipRowProps) {
  if (channels.length === 0) {
    if (emptyMessage) {
      return (
        <p className={`text-[12px] leading-snug text-[#909090] ${className}`.trim()}>
          {emptyMessage}
        </p>
      );
    }
    return null;
  }
  return (
    <div className={`flex flex-wrap items-center gap-[6px] ${className}`.trim()}>
      {channels.map((c) => (
        <CommunicationChannelChip key={c} channel={c} />
      ))}
    </div>
  );
}

/** Chip clicável para preferências E-mail / WhatsApp (colaboradores). */
export function CommunicationPreferenceChannelToggle(props: {
  channel: "EMAIL" | "WHATSAPP";
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const { channel, active, onToggle, disabled } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`${chipBase} transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? communicationChannelChipClass(channel)
          : "border-[#2e2e2e] bg-[#141414] text-[#606060] hover:border-[#404040] hover:text-[#909090]"
      }`}
    >
      {communicationChannelLabel(channel)}
    </button>
  );
}
