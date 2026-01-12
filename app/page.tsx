export const dynamic = "force-dynamic";
export const revalidate = 0;

type Jogo = {
  id: string;
  competicao: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  mandante: string;
  visitante: string;
  ondeAssistir: string;
  link?: string;
};

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR-uxWu_jDNEq9htZeOqQYOgLzrwbGQlYNfvbVbI8Bq8xIxcgebt_E9XyMTmhTbdB6A4plJj2qiIKn-/pub?gid=0&single=true&output=csv";

const DURACAO_PADRAO_MIN = 150; // 2h30 (futebol)
function slugTime(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escudoSrc(time: string) {
  const slug = slugTime(time);

  // ajustes manuais pra nomes específicos
  const map: Record<string, string> = {
    "rb-bragantino": "rb-bragantino",
    "sao-paulo": "sao-paulo",
  };

  const finalSlug = map[slug] || slug;

  return `/escudos/${finalSlug}.svg`;
}

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toDateTime(data?: string, hora?: string) {
  if (!data || !hora) return new Date(0);

  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);

  if (!y || !m || !d) return new Date(0);

  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isAoVivo(j: Jogo) {
  const inicio = toDateTime(j.data, j.hora);
  const fim = addMinutes(inicio, DURACAO_PADRAO_MIN);
  const agora = new Date();
  return agora >= inicio && agora <= fim;
}
function diffMin(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function statusCountdown(j: Jogo) {
  const agora = new Date();
  const inicio = toDateTime(j.data, j.hora);
  const fim = addMinutes(inicio, DURACAO_PADRAO_MIN);

  if (agora < inicio) {
    const mins = diffMin(agora, inicio);
    return { label: `Começa em ${formatarDuracao(mins)}`, tipo: "antes" as const };
  }

  if (agora >= inicio && agora <= fim) {
    const mins = diffMin(agora, fim);
    return { label: `Termina em ${formatarDuracao(mins)}`, tipo: "aoVivo" as const };
  }

  return null;
}

function parseCSV(csv: string): Jogo[] {
  const linhas = csv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (linhas.length < 2) return [];

  // ✅ Se vier a linha extra tipo "A,B,C,D,E,F,G,H", ignora
  const primeira = linhas[0].replace(/\r/g, "").trim().toLowerCase();
  const segunda = (linhas[1] || "").replace(/\r/g, "").trim().toLowerCase();

  const pareceABC = primeira.startsWith("a,b,c");
  const segundaEhCabecalho = segunda.startsWith("id,");

  const linhasValidas = pareceABC && segundaEhCabecalho ? linhas.slice(1) : linhas;

  const cabecalho = linhasValidas[0]
    .split(",")
    .map((h) =>
      h
        .replace(/^\uFEFF/, "")
        .replace(/\r/g, "")
        .trim()
        .toLowerCase()
    );

  const dados: Jogo[] = linhasValidas.slice(1).map((linha) => {
    const colunas = linha.split(",").map((c) => c.replace(/\r/g, "").trim());

    const raw: Record<string, string> = {};
    cabecalho.forEach((h, i) => {
      raw[h] = colunas[i] ?? "";
    });

    return {
      id: raw["id"] || "",
      competicao: raw["competicao"] || "",
      data: raw["data"] || "",
      hora: raw["hora"] || "",
      mandante: raw["mandante"] || "",
      visitante: raw["visitante"] || "",
      ondeAssistir: raw["ondeassistir"] || "",
      link: raw["link"] || "",
    };
  });

  return dados.filter((j) => j.data && j.hora && j.mandante && j.visitante);
}

async function getJogos(): Promise<Jogo[]> {
  const res = await fetch(CSV_URL, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  const texto = await res.text();
  return parseCSV(texto);
}


function Card({ j }: { j: Jogo }) {
  const aoVivo = isAoVivo(j);
  const countdown = statusCountdown(j);

const classes = [
  "block rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-5",
  "shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur",
  "transition duration-200",
  "hover:border-zinc-700 hover:bg-zinc-900/40 hover:-translate-y-[1px]",
  "active:translate-y-0",
].join(" ");


  return (
    <a
      href={j.link || undefined}
      target={j.link ? "_blank" : undefined}
      rel={j.link ? "noreferrer" : undefined}
      className={classes}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-400">{j.competicao}</div>

        {aoVivo && (
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-950/40 px-3 py-1 text-[11px] font-semibold text-red-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            AO VIVO
          </div>
        )}
      </div>

  <div className="mt-2 flex items-center gap-3">
  <img
  src={escudoSrc(j.mandante)}
  alt={j.mandante}
  width={36}
  height={36}
  className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
/>

  <div className="text-lg sm:text-xl font-bold leading-snug">
    {j.mandante} <span className="text-zinc-400">×</span> {j.visitante}
  </div>

  <img
  src={escudoSrc(j.visitante)}
  alt={j.visitante}
  width={36}
  height={36}
  className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
/>

</div>

      {countdown && (
        <div
          className={[
            "mt-2 inline-flex w-fit items-center rounded-full border px-2 py-1 text-[11px] font-semibold",
            countdown.tipo === "aoVivo"
              ? "border-red-500/40 bg-red-950/40 text-red-200"
              : "border-zinc-700 bg-zinc-900/40 text-zinc-200",
          ].join(" ")}
        >
          ⏳ {countdown.label}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-200">
        <span>🗓️ {formatarDataBR(j.data)}</span>
        <span>⏰ {j.hora}</span>
        <span>📺 {j.ondeAssistir}</span>
      </div>
    </a>
  );
}



export default async function Home({
  searchParams,
}: {
  searchParams?: { c?: string };
}) {

  const jogos = await getJogos();
const competicoes = Array.from(
  new Set(jogos.map((j) => j.competicao).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "pt-BR"));

const compSelecionada = (searchParams?.c || "").trim();
const jogosFiltrados =
  compSelecionada && compSelecionada !== "Todos"
    ? jogos.filter((j) => j.competicao === compSelecionada)
    : jogos;

  const agora = new Date();
  const inicioHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    0,
    0,
    0,
    0
  );
  const fimHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    23,
    59,
    59,
    999
  );

  const ordenados = [...jogosFiltrados].sort(
  (a, b) =>
    toDateTime(a.data, a.hora).getTime() - toDateTime(b.data, b.hora).getTime()
);


  const hoje = ordenados.filter((j) => {
    const dt = toDateTime(j.data, j.hora);
    return dt >= inicioHoje && dt <= fimHoje;
  });

const hojeOrdenado = [...hoje].sort((a, b) => {
  const aAoVivo = isAoVivo(a) ? 1 : 0;
  const bAoVivo = isAoVivo(b) ? 1 : 0;

  if (bAoVivo !== aAoVivo) return bAoVivo - aAoVivo; // AO VIVO primeiro

  // Se ambos são ao vivo ou ambos não são: ordena por horário
  return (
    toDateTime(a.data, a.hora).getTime() - toDateTime(b.data, b.hora).getTime()
  );
});

  const proximos = ordenados.filter((j) => toDateTime(j.data, j.hora) > fimHoje);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
     <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-8">
  <div className="flex items-center gap-4">
    {/* Logo / Badge */}
    <div className="h-11 w-11 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 flex items-center justify-center font-black text-sm tracking-tight">
      CNJ
    </div>

    {/* Título */}
    <div>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
  Cazé no Jogo
</h1>
   <p className="mt-1 text-sm sm:text-base text-zinc-400">
  Próximas transmissões — horário de Brasília
</p>

    </div>
  </div>
</header>

<div className="mt-6 flex flex-wrap gap-2">
  <a
    href="/"
    className={[
      "rounded-full border px-3 py-1.5 text-sm transition active:scale-[0.98]",
      !compSelecionada
        ? "border-zinc-200/30 bg-zinc-100/10 text-zinc-50"
        : "border-zinc-800 text-zinc-300 hover:bg-zinc-900/50",
    ].join(" ")}
  >
    Todos
  </a>

  {competicoes.map((c) => {
    const ativo = c === compSelecionada;
    return (
      <a
        key={c}
        href={`/?c=${encodeURIComponent(c)}`}
        className={[
          "rounded-full border px-3 py-1 text-sm transition",
          ativo
            ? "border-zinc-200/30 bg-zinc-100/10 text-zinc-50"
            : "border-zinc-800 text-zinc-300 hover:bg-zinc-900/50",
        ].join(" ")}
      >
        {c}
      </a>
    );
  })}
</div>

        {hoje.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Hoje
            </h2>
            <div className="space-y-3">
             {hojeOrdenado.map((j) => (
  <Card key={j.id} j={j} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Próximos
          </h2>

          {proximos.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-300">
              Sem jogos programados nos próximos dias.
            </div>
          ) : (
            <div className="space-y-3">
              {proximos.map((j) => (
                <Card key={j.id} j={j} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-zinc-500">Feito por Gi Rubio 💚</footer>
      </div>
    </main>
  );
}
