const Discord = require("discord.js");
    config = require("./config");
    Enmap = require("enmap");

const client = new Discord.Client({
  allowedMentions: {
    parse: ["roles", "users"],
    repliedUser: false,
  },
  partials: ['MESSAGE', 'CHANNEL'],
  intents: [ 
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MEMBERS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
  ],
});

client.login(config.token)

client.settings = new Enmap({name: "settings"});

client.on("ready", () => {
    console.log(`${client.user.tag} est connecté!`);
})

client.on("messageCreate", async (message) => {
    if(!message.guild || message.author.bot) return;

    let args = message.content.slice(config.prefix.length).trim().split(" ");
    let cmd = args.shift()?.toLowerCase();

    if(!message.content.startsWith(config.prefix) || !cmd || cmd.length == 0) return;

    client.settings.ensure(message.guildId, {
        TicketSystem1: {
            channel: "",
            message: "",
            category: "",
        }
    })

    if(cmd == "ping") {
        return message.reply(`\`🏓\` Pong! \`${client.ws.ping}ms\``)
    }
    if(cmd == "close") {
        let ticketUserId = client.settings.findKey(d => d.channelId == message.channelId);

        if(!client.settings.has(ticketUserId)){
            return message.reply({
                content: `:x: Ce channel n'est pas un ticket.`
            })
        }
        client.settings.delete(ticketUserId);
        message.reply("Le ticket sera fermé d'ici 3 secondes");
        setTimeout(() => {
            message.channel.delete().catch(()=>{});
        }, 3000)
    }
    if(cmd == "setup") {
        let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]); 
        if(!channel) return message.reply(":x: Merci de mentionné le channel ```Exemple: t!ticket #channel```");

        let TicketEmbed = new Discord.MessageEmbed()
            .setColor("YELLOW")
            .setTitle("`🎟️` Créer un ticket")
            .setDescription("__Sélectionnez pour quoi vous avez besoin d'aide.__")
            .setFooter(message.guild.name, message.guild.iconURL({dynamic: true}));
        
            let Menu = new Discord.MessageSelectMenu()
            .setCustomId("1ticket")
            .setPlaceholder("Clique ici pour ouvrir un ticket")
            .setMaxValues(1) 
            .setMinValues(1)
            .addOptions([
                {
                    label: "Aide générale".substr(0, 25),
                    value: "gen_h".substr(0, 25), 
                    description: "Si vous avez une question sur notre projet".substr(0, 50), 
                    emoji: "🚀",
                },
                {
                    label: "Aide pour payements".substr(0, 25),
                    value: "order_h".substr(0, 25), 
                    description: "Si vous avez besoin d'aide pour commander un produit".substr(0, 70),
                    emoji: "🪙",
                }
            ])
        let row = new Discord.MessageActionRow().addComponents(Menu);
        
        channel.send({
            embeds: [TicketEmbed],
            components: [row]
        }).then((msg) => {
            client.settings.set(message.guildId, channel.id, "TicketSystem1.channel")
            client.settings.set(message.guildId, msg.id, "TicketSystem1.message")
            client.settings.set(message.guildId, channel.parentId, "TicketSystem1.category")
            return message.reply("🔔 Mise en place terminé");
        }).catch((e) => {
            console.log(e);
            return message.reply("Un soucis a été rencontrer");
        })
    }
})

client.on("interactionCreate", async (interaction) => {
    if(!interaction.isSelectMenu() || !interaction.guildId || interaction.message.author.id != client.user.id) return
    
    client.settings.ensure(interaction.guildId, {
        TicketSystem1: {
            channel: "",
            message: "",
            category: "",
        }
    })

    let data = client.settings.get(interaction.guildId)
    if(!data.TicketSystem1.channel || data.TicketSystem1.channel.length == 0) return


    if(interaction.channelId == data.TicketSystem1.channel && interaction.message.id == data.TicketSystem1.message) {        
        switch(interaction.values[0]){
            case "gen_h": {
                let channel = await CreateTicket({
                    OpeningMessage: "Création du ticket...",
                    ClosedMessage: `Ticket ouvert juste ici: <#{channelId}>`,
                    embeds: [ new Discord.MessageEmbed().setColor("GREEN").setTitle("Comment pourrais-je t'aider ?").setTimestamp()]
                }).catch(e=>{
                    return console.log(e)
                })
                console.log(channel.name);
            } break;
            case "order_h": {
                let channel = await CreateTicket({
                    OpeningMessage: "Création du ticket...",
                    ClosedMessage: `Ticket ouvert juste ici: <#{channelId}>`,
                    embeds: [ new Discord.MessageEmbed().setColor("ORANGE").setTitle("Comment pourrais-je t'aider ?").setTimestamp()]
                }).catch(e=>{
                    return console.log(e)
                })
                console.log(channel.name);
            } break;
        }
        
        async function CreateTicket(ticketdata) {
            return new Promise(async function(resolve, reject) {
                await interaction.reply({
                    ephemeral: true,
                    content: ticketdata.OpeningMessage
                })
                let { guild } = interaction.message;
                let category = guild.channels.cache.get(data.TicketSystem1.category);
                if(!category || category.type != "GUILD_CATEGORY") category = interaction.message.channel.parentId || null; 
                let optionsData = {
                    type: "GUILD_TEXT",
                    topic: `${interaction.user.tag} | ${interaction.user.id}`,
                    permissionOverwrites: [],
                }
                if(client.settings.has(interaction.user.id)){
                    let TicketChannel = guild.channels.cache.get(client.settings.get(interaction.user.id, "channelId"))
                    if(!TicketChannel) {
                        client.settings.delete(interaction.user.id)
                    } else {
                        return interaction.editReply({
                            ephemeral: true,
                            content: `Tu as déjà un ticket ! : <#${TicketChannel.id}>`
                        })
                    }
                }
                optionsData.permissionOverwrites = [...guild.roles.cache.values()].sort((a, b) => b?.rawPosition - a.rawPosition).map(r => {
                    let Obj = {}
                    if(r.id){
                        Obj.id = r.id;
                        Obj.type = "role";
                        Obj.deny = ["SEND_MESSAGES", "VIEW_CHANNEL", "EMBED_LINKS", "ADD_REACTIONS", "ATTACH_FILES"]
                        Obj.allow = [];
                        return Obj;
                    } else {
                        return false;
                    }
                }).filter(Boolean);
                optionsData.permissionOverwrites.push({
                    id: interaction.user.id,
                    type: "member",
                    allow: ["SEND_MESSAGES", "VIEW_CHANNEL", "EMBED_LINKS", "ADD_REACTIONS", "ATTACH_FILES"],
                    deny: [],
                })
                while (optionsData.permissionOverwrites.length >= 99){
                optionsData.permissionOverwrites.shift();
                }
                if(category) optionsData.parent = category;
                guild.channels.create(`ticket-${interaction.user.username.split(" ").join("-")}`.substr(0, 32), optionsData).then(async channel => {
                    await channel.send({
                        content: `<@${interaction.user.id}>`,
                        embeds: ticketdata.embeds
                    }).catch(()=>{});
                    client.settings.set(interaction.user.id, {
                        userId: interaction.user.id,
                        channelId: channel.id,
                    })
                    await interaction.editReply({
                        ephemeral: true,
                        content: ticketdata.ClosedMessage.replace("{channelId}", channel.id)
                    }).catch(()=>{});
                    resolve(channel);
                }).catch((e)=>{
                    reject(e)
                });
            })
            
        }

    } 
})