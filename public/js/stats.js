const guildCountBody = document.getElementById("server_count");
const memberCountBody = document.getElementById("user_count");
const commandCountBody = document.getElementById("commands_count")

const ranksPlaceholder = document.getElementById("first-glb");
async function setStats(){
try {
    const stats = await (await fetch("/api/stats")).json();
    guildCountBody.innerHTML = stats.guilds
  memberCountBody.innerHTML = stats.members
  commandCountBody.innerHTML = stats.commands
} catch (e) {
  console.log(e);
  guildCountBody.innerHTML = "ERROR";
  memberCountBody.innerHTML = "ERROR";
}
}

async function setGlb(){
try {
    const glb = await (await fetch("/api/glb?name=true")).json();
    ranksPlaceholder.innerHTML = `${glb[0].name}: ${glb[0].Amount.toLocaleString()} <img src = "../Imgs/dcoin.png" alt="dcoins_icon" width="30px" height="30px"></img>`
} catch (e) {
  console.log(e);;
  ranksPlaceholder.innerHTML = "ERROR FETCHING";
}
}


function onLoad() {
  setStats()
  setGlb()
}

onLoad()