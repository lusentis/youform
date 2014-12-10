'use strict';

module.exports = {
  Types: {
    id: 'S',
    userId: 'S',
    created_at: 'S',
    user_ip: 'S',
    spam: 'BOOL'
  },
  default: {
    id: '',
    userId: '',
    created_at: null,
    user_ip: '',
    spam: false
  }
};