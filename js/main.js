
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
  // Native constraints stay in the HTML; JS adds inline, persistent feedback.
  form.noValidate = true;
  const fields = ['name', 'email', 'organisation', 'subject', 'message', 'consent'];
  const summary = document.querySelector('#form-errors');
  const status = document.querySelector('#form-status');
  const submitButton = form.querySelector('[type="submit"]');
  const submitLabel = submitButton.querySelector('span');
  const success = document.querySelector('#form-success');
  const message = document.querySelector('#message');
  let isSubmitting = false;

  message.addEventListener('input', () => {
    document.querySelector('#message-count').textContent = `${message.value.length.toLocaleString('en-GB')} / 5,000`;
  });

  function clearErrors() {
    summary.hidden = true;
    summary.querySelector('ul').replaceChildren();
    fields.forEach((name) => {
      document.getElementById(name).removeAttribute('aria-invalid');
      const error = document.getElementById(`${name}-error`);
      error.hidden = true;
      error.textContent = '';
    });
  }

  function displayErrors(errors) {
    clearErrors();
    for (const [name, message] of Object.entries(errors)) {
      if (!fields.includes(name)) continue;
      const input = document.getElementById(name);
      input.setAttribute('aria-invalid', 'true');
      const error = document.getElementById(`${name}-error`);
      error.textContent = message;
      error.hidden = false;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${name}`;
      link.textContent = message;
      link.addEventListener('click', () => input.focus());
      item.append(link);
      summary.querySelector('ul').append(item);
    }
    if (summary.querySelector('li')) {
      summary.hidden = false;
      summary.focus();
    }
  }

  function validate(values) {
    const errors = {};
    if (values.name.length < 2 || values.name.length > 100) errors.name = 'Please enter your name using 2–100 characters.';
    if (!values.email || !document.querySelector('#email').validity.valid) errors.email = 'Please enter a valid email address.';
    if (values.organisation.length > 160) errors.organisation = 'Please use no more than 160 characters for your organisation.';
    if (!['placement', 'collaboration', 'general'].includes(values.subject)) errors.subject = 'Please choose what you would like to discuss.';
    if (values.message.length < 10 || values.message.length > 5000) errors.message = 'Please write a message using 10–5,000 characters.';
    if (!values.consent) errors.consent = 'Please agree to your details being stored so this enquiry can be answered.';
    return errors;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    status.textContent = '';
    const data = new FormData(form);
    const values = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      organisation: String(data.get('organisation') || '').trim(),
      subject: String(data.get('subject') || ''),
      message: String(data.get('message') || '').trim(),
      consent: document.querySelector('#consent').checked,
      website: String(data.get('website') || ''),
    };
    const errors = validate(values);
    if (Object.keys(errors).length) {
      displayErrors(errors);
      return;
    }
    clearErrors();
    isSubmitting = true;
    submitButton.disabled = true;
    submitLabel.textContent = 'Submitting…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || !result.id) {
        if (result.errors && Object.keys(result.errors).length) displayErrors(result.errors);
        throw new Error(result.error || 'Your message could not be submitted. Please try again.');
      }
      success.querySelector('.submission-reference').textContent = `Submission reference: ${result.id}`;
      form.hidden = true;
      document.querySelector('.form-heading').hidden = true;
      success.hidden = false;
      form.reset();
      document.querySelector('#message-count').textContent = '0 / 5,000';
      success.focus();
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? 'The connection timed out. Your message is still here. Please try again.'
        : (error instanceof SyntaxError || error instanceof TypeError
          ? 'The contact service could not be reached. Your message is still here. Please try again.'
          : error.message);
    } finally {
      window.clearTimeout(timeout);
      isSubmitting = false;
      submitButton.disabled = false;
      submitLabel.textContent = 'Send message';
      form.removeAttribute('aria-busy');
    }
  });

  document.querySelector('#send-another').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    document.querySelector('.form-heading').hidden = false;
    status.textContent = '';
    clearErrors();
    document.querySelector('#name').focus();
  });
}
