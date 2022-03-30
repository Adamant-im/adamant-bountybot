const db = require('./DB');
const config = require('./configReader');
const helpers = require('../helpers');
const log = require('../helpers/log');
const api = require('./api');
const Store = require('./Store');

const hours_for_new_contact = 72;
const excluded_adm_contacts = [
  'U5149447931090026688', // Exchange bot
  'U17840858470710371662', // Bet bot
  'U16009208918899676597', // Info bot
  'U564927595221219641', // Heads or Tails bot
  'U8916295525136600565', // Orel i Reshka bot
  'U13524411455927458124', // BlackJack
  'U1058290473014173876', // Crypto alarm bot
  'U15423595369615486571', // Adoption and bounty
  'U17636520927910270607', // ADAMANT Contact
  'U6386412615727665758', // ADAMANT Contact
  'U1835325601873095435', // ADAMANT Foundation Adoption
  'U380651761819723095', // ADAMANT Foundation Donation
  Store.user.ADM.address, // This bot address
];

let inProcess = false;

module.exports = async () => {
  if (inProcess) return;
  inProcess = true;

  try {
    const {UsersDb} = db;

    const users = await UsersDb.find({
      $and: [
        {isInCheck: true},
        {isAdamantCheckPassed: false},
        {isTasksCompleted: false},
      ],
    });

    for (const user of users) {
      try {
        const {
          userId,
        } = user;

        log.log(`Running module ${helpers.getModuleName(module.id)} for user ${userId}…`);

        let msgSendBack = '';
        let contactsNumber = 0;
        const txChatAll = await api.get('chats/get', {recipientId: userId, orderBy: 'timestamp:desc', limit: 100});
        if (txChatAll.success) {
          const txChat = txChatAll.data.transactions.filter((v, i, a)=>a.findIndex((t)=>(t.senderId === v.senderId))===i);

          let need_new_contacts = false;

          for (let index = 0; ((index < txChat.length) && (contactsNumber < config.adamant_campaign.min_contacts)); index++) {
            if (excluded_adm_contacts.includes(txChat[index].senderId)) {
              continue;
            }
            const res = await api.get('chats/get', {senderId: txChat[index].senderId, orderBy: 'timestamp:asc', limit: 1});
            if (res.success) {
              const contactFirstChat = res.data.transactions[0].timestamp;
              const hoursOld = (helpers.unix() - helpers.toTimestamp(contactFirstChat)) / 1000 / 60 / 60;
              if (hoursOld > hours_for_new_contact) {
                need_new_contacts = true;
                continue;
              }
              contactsNumber += 1;
            }
          }

          const isContactsDone = contactsNumber >= config.adamant_campaign.min_contacts;
          console.log('isContactsDone:', isContactsDone, contactsNumber);

          if (isContactsDone) {
            log.log(`User ${userId}… did make ${config.adamant_campaign.min_contacts} contacts.`);
            await user.update({
              isAdamantCheckPassed: true,
            }, true);
          } else {
            await user.update({
              isAdamantCheckPassed: false,
              isInCheck: false,
              isTasksCompleted: false,
            }, true);

            if (need_new_contacts) {
              msgSendBack = `To meet the Bounty campaign rules, you should invite ${config.adamant_campaign.min_contacts} friends in ADAMANT Messenger. They _should be new ADAMANT users_ and message you. They can join this bounty campaign as well! Invite friends and apply again.`;
            } else {
              msgSendBack = `To meet the Bounty campaign rules, you should invite ${config.adamant_campaign.min_contacts} friends in ADAMANT Messenger. They must message you. They can join this bounty campaign as well! Invite friends and apply again.`;
            }

            await api.sendMessage(config.passPhrase, userId, msgSendBack);
            log.log(`User ${userId}… did NOT make ${config.adamant_campaign.min_contacts} contacts. Message to user: ${msgSendBack}`);
          }
        }
      } catch (e) {
        log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e}`);
      }
    }
  } finally {
    inProcess = false;
  }
};

if (config.adamant_campaign.min_contacts > 0) {
  setInterval(() => {
    module.exports();
  }, 6 * 1000);
}
