const {
  NEW_EVENT_SEND_MESSAGE,
  NEW_EVENT_SEND_FAILED,
  NEW_EVENT_RECEIVE_MESSAGE,
  NEW_EVENT_TYPING,
  NEW_EVENT_STOP_TYPING
} = require('../../constants.json');
const { addMessage, getActiveUser } = require('../utils/lib');

const messageCounts = {};
const typingUsers = {};

module.exports = (socket) => {
  socket.on(NEW_EVENT_TYPING, ({ chatId }) => {
    const user = getActiveUser({ socketId: socket.id });
    if (user) {
      typingUsers[user.id] = true;
      socket.broadcast.to(chatId).emit(NEW_EVENT_TYPING, { userId: user.id });
    }
  });

  socket.on(NEW_EVENT_STOP_TYPING, ({ chatId }) => {
    const user = getActiveUser({ socketId: socket.id });
    if (user) {
      delete typingUsers[user.id];
      socket.broadcast.to(chatId).emit(NEW_EVENT_STOP_TYPING, { userId: user.id });
    }
  });

  socket.on(
    NEW_EVENT_SEND_MESSAGE,
    async ({ senderId, message, time, chatId, containsBadword, replyTo }, returnMessageToSender) => {
      const user = getActiveUser({ socketId: socket.id });

      if (!user) {
        socket.emit(NEW_EVENT_SEND_FAILED, {
          message: 'Hmmm. It seems your login session has expired. Re-login and try again',
        });
        return;
      }

      const userMessageCount = messageCounts[senderId] || 0;

      if (userMessageCount >= 25) {
        socket.emit(NEW_EVENT_SEND_FAILED, {
          message: 'You have exceeded the message limit. Please try again later.',
        });
        return;
      }

      const sentMessage = await addMessage(chatId, {
        message,
        time,
        senderId,
        type: 'message',
        containsBadword,
        replyTo,
      });

      const messageDetails = {
        ...sentMessage,
        room: chatId,
        status: 'sent',
      };

      returnMessageToSender(messageDetails);

      socket.broadcast.to(chatId).emit(NEW_EVENT_RECEIVE_MESSAGE, messageDetails);

      messageCounts[senderId] = userMessageCount + 1;

      setTimeout(() => {
        messageCounts[senderId] = 0;
      }, 60 * 1000);
    }
  );
};
