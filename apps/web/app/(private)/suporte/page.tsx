import { PageShell } from "@/app/components/page-shell";

export default function SuportePage() {
  return (
    <PageShell title="Suporte" section="gestao" subtitle="Ajuda e contacto">
      <div className="mx-auto max-w-[640px] px-6 py-8">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#161616] px-5 py-5 text-[13px] leading-relaxed text-[#c8c8c8]">
          <p className="mb-4">
            Precisa de ajuda com o SubtitleStudio? Verifique primeiro se a sessão
            está activa (menu do utilizador) e se o servidor da API está a correr
            em desenvolvimento local.
          </p>
          <p className="mb-4">
            <span className="font-[600] text-[#e8e8e8]">Contacto:</span>{" "}
            utilize o canal interno da sua equipa ou o email de suporte do
            projecto, se existir.
          </p>
          <p className="mb-0">
            <span className="font-[600] text-[#e8e8e8]">Reportar problema:</span>{" "}
            descreva os passos para reproduzir, o navegador utilizado e, se
            aplicável, o ID do projecto ou ficheiro. Anexe capturas de ecrã
            sempre que possível.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
