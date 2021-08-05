const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const api = require('./api');
const Store = require('./Store');

const hours_for_new_contact = 72;
const excluded_adm_contacts = [
    "U5149447931090026688", // Exchange bot
    "U17840858470710371662", // Bet bot
    "U16009208918899676597", // Info bot
    "U564927595221219641", // Heads or Tails bot
    "U8916295525136600565", // Orel i Reshka bot
    "U13524411455927458124", // BlackJack
    "U1058290473014173876", // Crypto alarm bot
    "U15423595369615486571", // Adoption and bounty
    "U17636520927910270607", // ADAMANT Contact
    "U6386412615727665758", // ADAMANT Contact
    "U1835325601873095435", // ADAMANT Foundation Adoption
    "U380651761819723095", // ADAMANT Foundation Donation
    Store.user.ADM.address // This bot address
]

let inProcess = false;

module.exports = async () => {

    if (inProcess) return;
    inProcess = true;
    
    try {

        const {usersDb} = db;

        const users = await usersDb.find({
            $and: [
                {isInCheck: true},
                {isAdamantCheckPassed: false},
                {isTasksCompleted: false}
            ]        
        });
        
        for (const user of users) {
            try {
                const {
                    userId
                } = user;

                console.log(`Running module ${$u.getModuleName(module.id)} for user ${userId}…`);

                let msgNotify = '';
                let msgNotifyType = '';
                let msgSendBack = '';
                
                let isContactsDone;
                let contacts_number = 0;

                let txChat_all = (await api.get('uri', 'chats/get/?recipientId=' + userId + '&orderBy=timestamp:desc&limit=100')).transactions;
                let txChat = txChat_all.filter((v,i,a)=>a.findIndex(t=>(t.senderId === v.senderId))===i);

                let contact_firstchat;
                let hours_old;
                let need_new_contacts = false;

                for (let index = 0; ((index < txChat.length) && (contacts_number < config.adamant_campaign.min_contacts)); index++) {
                    if (excluded_adm_contacts.includes(txChat[index].senderId)) {
                        continue;
                    }
                    contact_firstchat = (await api.get('uri', 'chats/get/?senderId=' + txChat[index].senderId + '&orderBy=timestamp:asc&limit=1'));
                    contact_firstchat = contact_firstchat.transactions[0].timestamp;
                    hours_old = ($u.unix() - $u.toTimestamp(contact_firstchat)) / 1000 / 60 / 60;
                    if (hours_old > hours_for_new_contact) {
                        need_new_contacts = true;
                        continue;
                    }
                    contacts_number += 1;
                }

                isContactsDone = contacts_number >= config.adamant_campaign.min_contacts;
                console.log('isContactsDone:', isContactsDone, contacts_number);

                if (isContactsDone) {

                    console.log(`User ${userId}… did make ${config.adamant_campaign.min_contacts} contacts.`);
                    await user.update({
                        isAdamantCheckPassed: true
                    }, true);

                } else {

                    await user.update({
                        isAdamantCheckPassed: false,
                        isInCheck: false,
                        isTasksCompleted: false
                    }, true);

                    if (need_new_contacts) {
                        msgSendBack = `To meet the Bounty campaign rules, you should invite ${config.adamant_campaign.min_contacts} friends in ADAMANT Messenger. They _should be new ADAMANT users_ and message you. They can join this bounty campaign as well! Invite friends and apply again.`;
                    } else {
                        msgSendBack = `To meet the Bounty campaign rules, you should invite ${config.adamant_campaign.min_contacts} friends in ADAMANT Messenger. They must message you. They can join this bounty campaign as well! Invite friends and apply again.`;
                    }
                    
                    await $u.sendAdmMsg(userId, msgSendBack);
                    log.info(`User ${userId}… did NOT make ${config.adamant_campaign.min_contacts} contacts. Message to user: ${msgSendBack}`);
                }
        
            } catch (e) {
                log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
            }
            
        };

    } finally {
        inProcess = false;        
    }

};

if (config.adamant_campaign.min_contacts > 0)
    setInterval(() => {
        module.exports();
    }, 6 * 1000);
