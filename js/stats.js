console.log("Stats loaded")

async function loadStats() {
  const data = await fetch("https://top.gg/api/bots/658566989077544970").then((res) => res.json());
  console.log(data)
}

const serverCountDiv = document.getElementById("server_count")
const userCountDiv = document.getElementById("user_count")
const commandsRunDiv = document.getElementById("commands_run")

serverCountDiv.innerHTML = "pp"

function onload(){
  loadStats()
}

onload()
//https://api.statcord.com/v3/658566989077544970
