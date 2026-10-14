// Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local (on your PC) or in Vercel's Environment Variables.
export const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export const SCOPE = "https://www.googleapis.com/auth/drive.file";
export const FOLDER_NAME = "Meme Vault";
export const LIB_NAME = "meme-vault-library.json";
export const THUMBS_NAME = "meme-vault-thumbs.json";
export const DRIVE = "https://www.googleapis.com/drive/v3/files";
export const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export const PRESET_TAGS = ["awkward","fail","shock","victory","roast","savage","cringe","laugh","sad","angry","confused","suspense","dramatic","facepalm","bruh","wholesome","reveal","transition","boom","slow-mo"];

export const SITUATIONS = [
  ["😬 Awkward silence","awkward"],["🔥 Got roasted","roast"],["💀 Epic fail","fail"],["😱 Shock","shock"],
  ["🏆 Victory","victory"],["🤔 Confused","confused"],["😭 Sad moment","sad"],["😡 Angry","angry"],
  ["🎭 Dramatic","dramatic"],["😂 Laugh","laugh"],["🤦 Facepalm","facepalm"],["✨ Transition","transition"],
];

// Words people type → tags they probably mean
export const SYN = {
  roast:["roast","savage"],burn:["roast","savage"],insult:["roast","savage"],savage:["savage","roast"],diss:["roast","savage"],
  awkward:["awkward","cringe"],silence:["awkward"],silent:["awkward"],embarrass:["awkward","cringe"],cringe:["cringe","awkward"],
  fail:["fail","facepalm"],oops:["fail"],mistake:["fail","facepalm"],fall:["fail"],slip:["fail"],
  shock:["shock","reveal"],surprise:["shock","reveal"],omg:["shock"],wow:["shock"],twist:["reveal","shock"],
  win:["victory"],victory:["victory"],success:["victory"],celebrate:["victory"],proud:["victory"],
  sad:["sad"],cry:["sad"],emotional:["sad","dramatic"],heartbreak:["sad"],
  angry:["angry"],rage:["angry"],mad:["angry"],shout:["angry"],
  confus:["confused"],confused:["confused"],huh:["confused","bruh"],
  laugh:["laugh"],funny:["laugh"],lol:["laugh"],joke:["laugh"],
  drama:["dramatic","suspense"],dramatic:["dramatic"],tension:["suspense"],suspense:["suspense"],
  bruh:["bruh","facepalm"],facepalm:["facepalm","bruh"],
  cute:["wholesome"],sweet:["wholesome"],explode:["boom"],explosion:["boom"],
  cut:["transition"],switch:["transition"],
};

export const STOP = new Set("a an the and or of to in on at is are was he she they it his her their my me i you someone somebody when gets get got very so just with for this that".split(" "));

export const EXT = {
  video:["mp4","mov","webm","mkv","m4v","avi"],
  audio:["mp3","wav","ogg","m4a","aac","flac","opus"],
  image:["gif","png","jpg","jpeg","webp"],
};
