export {
  initDatabase,
  persistDatabase,
  getDbFilePath,
} from './db/core';

export {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from './db/settingsRepo';

export {
  listUserMemories,
  addUserMemory,
  updateUserMemory,
  deleteUserMemory,
  clearAllUserMemories,
} from './db/memoriesRepo';

export {
  listChats,
  getChatById,
  createChatInDb,
  updateChatInDb,
  deleteChatFromDb,
  getMessagesByChatId,
  saveMessageInDb,
  truncateMessagesFromIdInDb,
  markMessagesCompressedInDb,
} from './db/chatsRepo';

export {
  listMcpServers,
  saveMcpServer,
  deleteMcpServer,
  listSkills,
  saveSkill,
  deleteSkill,
  listAiProviders,
  saveAiProvider,
  deleteAiProvider,
} from './db/extensionsRepo';

export {
  getDatabaseFileStats,
  getTableSchema,
  listDbTables,
  getTableRows,
  updateTableRow,
  insertTableRow,
  deleteTableRow,
  executeRawSql,
  vacuumDatabase,
} from './db/devRepo';
