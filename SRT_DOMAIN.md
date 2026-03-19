# SubtitleBot — Regras do Domínio SRT

## Parser
O parser deve:

- aceitar texto `.srt`
- normalizar quebras de linha
- separar blocos
- validar índice
- validar intervalo de tempo
- converter `HH:MM:SS,mmm` para milissegundos
- unir linhas de texto multilinha
- devolver uma lista estruturada de cues

### Exemplo de entrada

```srt
1
00:00:01,000 --> 00:00:03,000
Olá, tudo bem?

2
00:00:04,000 --> 00:00:06,500
Vamos começar.
```

### Exemplo de saída

```ts
[
  {
    cueIndex: 1,
    startMs: 1000,
    endMs: 3000,
    text: "Olá, tudo bem?",
  },
  {
    cueIndex: 2,
    startMs: 4000,
    endMs: 6500,
    text: "Vamos começar.",
  },
];
```

## Formatter
O formatter deve:

- ordenar por `cueIndex`
- converter `ms` para `HH:MM:SS,mmm`
- gerar a string final em formato `.srt`

## Regras mínimas do editor

### Campos editáveis
- índice visual
- início
- fim
- texto

### Regras de validação
- `startMs < endMs`
- texto não deve ficar vazio sem aviso
- ordenação por `cueIndex` deve ser preservada
- no começo, edição simples é suficiente

## Padrão interno
- tempos sempre em milissegundos no banco
- texto salvo como string simples do cue
- versão exportada salva como string `.srt`
