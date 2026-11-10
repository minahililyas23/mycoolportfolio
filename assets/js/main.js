
'use strict';

document.documentElement.classList.add('has-js');

// Keep navigation available without JavaScript, and collapse it on small screens.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
if (menuButton && navigation) {
  menuButton.hidden = false;
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    navigation.classList.toggle('is-open', !isOpen);
  });
  navigation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
  window.matchMedia('(min-width: 601px)').addEventListener('change', closeMenu);
}

const form = document.querySelector('#contact-form');
if (form) {
  // This coursework demonstration validates in the browser only.
  // It makes no network request and does not use persistent storage.
  const fields = ['name', 'email', 'organisation', 'subject', 'message'];
  const controls = document.querySelector('#contact-fields');
  const summary = document.querySelector('#form-errors');
  const status = document.querySelector('#form-status');
  const success = document.querySelector('#form-success');
  const heading = document.querySelector('.form-heading');
  const message = document.querySelector('#message');
  const messageCount = document.querySelector('#message-count');

  function updateMessageCount() {
    messageCount.textContent = message.value.length.toLocaleString('en-GB') + ' / 5,000';
  }

  function clearErrors() {
    summary.hidden = true;
    summary.querySelector('ul').replaceChildren();
    fields.forEach((name) => {
      document.getElementById(name).removeAttribute('aria-invalid');
      const error = document.getElementById(name + '-error');
      error.hidden = true;
      error.textContent = '';
    });
  }

  function displayErrors(errors) {
    clearErrors();
    for (const [name, errorMessage] of Object.entries(errors)) {
      const input = document.getElementById(name);
      input.setAttribute('aria-invalid', 'true');
      const error = document.getElementById(name + '-error');
      error.textContent = errorMessage;
      error.hidden = false;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + name;
      link.textContent = errorMessage;
      link.addEventListener('click', () => input.focus());
      item.append(link);
      summary.querySelector('ul').append(item);
    }
    summary.hidden = false;
    summary.focus();
  }

  function validate(values) {
    const errors = {};
    if (values.name.length < 2 || values.name.length > 100) {
      errors.name = 'Please enter your name using 2–100 characters.';
    }
    if (!values.email || !document.querySelector('#email').validity.valid) {
      errors.email = 'Please enter a valid email address.';
    }
    if (values.organisation.length > 160) {
      errors.organisation = 'Please use no more than 160 characters for your organisation.';
    }
    if (!['placement', 'collaboration', 'general'].includes(values.subject)) {
      errors.subject = 'Please choose what you would like to discuss.';
    }
    if (values.message.length < 10 || values.message.length > 5000) {
      errors.message = 'Please write a message using 10–5,000 characters.';
    }
    return errors;
  }

  form.addEventListener('submit', (event) => {
    // Stop normal submission before reading any entries.
    event.preventDefault();
    status.textContent = '';
    const data = new FormData(form);
    const values = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      organisation: String(data.get('organisation') || '').trim(),
      subject: String(data.get('subject') || ''),
      message: String(data.get('message') || '').trim(),
    };
    const errors = validate(values);
    if (Object.keys(errors).length) {
      displayErrors(errors);
      return;
    }

    clearErrors();
    form.hidden = true;
    heading.hidden = true;
    success.hidden = false;
    // Keep the values so "Edit details" can restore the same entries.
    success.focus();
  });

  function showForm() {
    success.hidden = true;
    form.hidden = false;
    heading.hidden = false;
    clearErrors();
    document.querySelector('#name').focus();
  }

  document.querySelector('#edit-details').addEventListener('click', () => {
    status.textContent = '';
    showForm();
  });

  document.querySelector('#start-again').addEventListener('click', () => {
    form.reset();
    updateMessageCount();
    showForm();
    status.textContent = 'The form has been cleared. You can start again.';
  });

  message.addEventListener('input', updateMessageCount);

  // Enable only after handlers exist. With JavaScript disabled, the disabled
  // fieldset prevents accidental submission of personal details in the URL.
  form.noValidate = true;
  controls.disabled = false;
  updateMessageCount();
}

