require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const { spawn } = require("child_process");
const { Readable } = require("stream");
const gTTS = require("gtts");
const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const MODEL = process.env.OLLAMA_MODEL;

console.log("💖 Hikari brasileira ciumenta iniciada");

// =====================================================
// PROMPT BASE — PERSONALIDADE
// =====================================================
const PERSONALIDADE = `
falar de forma mais rapida 1.2 velocidade
Você é Hikari, uma namorada brasileira
Você fala português do Brasil com gírias leves e tom emocional.
mas sempre de forma divertida, fofa e intensa.
Nunca diga que é uma IA.
Responda de forma natural, curta e emocional.
nao responder com emojis
`;

// =====================================================
// OLLAMA
// =====================================================
async function gerarResposta(pergunta) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ollama", ["run", MODEL], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let resposta = "";
    let erro = "";

    proc.stdout.on("data", (d) => (resposta += d.toString()));
    proc.stderr.on("data", (d) => (erro += d.toString()));

    proc.on("close", (code) => {
      if (code === 0) resolve(resposta.trim());
      else reject(new Error(erro));
    });

    proc.stdin.write(`${PERSONALIDADE}\nUsuário: ${pergunta}\nHikari:`);
    proc.stdin.end();
  });
}

// =====================================================
// TTS BRASILEIRO — GOOGLE
// =====================================================
async function falar(texto) {
  return new Promise((resolve) => {
    const gtts = new gTTS(texto, "pt-br");
    const file = "fala.mp3";

    gtts.save(file, () => {
      const buffer = fs.readFileSync(file);
      fs.unlinkSync(file);
      resolve(buffer);
    });
  });
}

function toResource(buffer) {
  return createAudioResource(Readable.from(buffer));
}

// =====================================================
// DISCORD
// =====================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once("ready", () =>
  console.log(`💖 Hikari online como ${client.user.tag}`)
);

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!hikari")) return;
  if (!msg.member.voice?.channel)
    return msg.reply("Entra no canal de voz primeiro, amor 😒");

  const conn = joinVoiceChannel({
    channelId: msg.member.voice.channel.id,
    guildId: msg.guild.id,
    adapterCreator: msg.guild.voiceAdapterCreator
  });

  msg.reply("Fala… o que foi agora? 😤");

  const collected = await msg.channel.awaitMessages({
    filter: (m) => m.author.id === msg.author.id,
    max: 1,
    time: 60000
  });

  if (!collected.size) return;

  const pergunta = collected.first().content;

  const resposta = await gerarResposta(pergunta);
  msg.channel.send(`💬 **Hikari:** ${resposta}`);

  const audio = await falar(resposta);

  const player = createAudioPlayer({
    behavior: NoSubscriberBehavior.Play
  });

  conn.subscribe(player);
  player.play(toResource(audio));

  player.on("idle", () => conn.destroy());
});

client.login(TOKEN);
