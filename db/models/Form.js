'use strict';

module.exports = {
  Types: {
    id: 'S',
    token: 'S',
    code: 'S',
    form_name: 'S',
    website_url: 'S',
    website_success_page: 'S',
    form_subject: 'S',
    form_intro: 'S',
    form_destination: 'S',
    creator_email: 'S',
    colours: 'S',
    phone: 'S',
    country_code: 'S',
    replyto_field: 'S',
    form_destination_not_confirmed: 'S',
    confirmed: 'BOOL',
    email_confirmed: 'BOOL',
    phone_confirmed: 'BOOL',
    deleted: 'BOOL'
  },
  default: {
    id: '',
    token: '',
    code: '',
    form_name: '',
    website_url: '',
    website_success_page: '',
    form_subject: '',
    form_intro: '',
    form_destination: '',
    creator_email: '',
    colours: '',
    phone: '',
    country_code: '',
    replyto_field: '',
    confirmed: false,
    email_confirmed: false,
    phone_confirmed: false
  }
};