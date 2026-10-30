import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planMediatorSave, settingsSaveError, type MediatorRecord } from './mediators.ts';

const anil: MediatorRecord = {
  id: '1',
  name: 'Anil Sahu',
  nameKey: 'anil sahu',
  phoneDisplay: '+91 98765 43210',
  phoneNormalized: '919876543210',
};
const yash: MediatorRecord = {
  id: '2',
  name: 'Yash',
  nameKey: 'yash',
  phoneDisplay: '',
  phoneNormalized: '',
};

describe('settingsSaveError', () => {
  it('blocks the same name and number', () => {
    assert.equal(settingsSaveError([anil], ' anil   sahu ', '919876543210'), 'Already in your mediators');
  });

  it('blocks a number already saved under another name', () => {
    assert.equal(
      settingsSaveError([anil], 'Other', '919876543210'),
      'This number is already saved as Anil Sahu',
    );
  });

  it('allows the same name with a different number', () => {
    assert.equal(settingsSaveError([anil], 'Anil Sahu', '919000011122'), null);
  });

  it('ignores the row being edited', () => {
    assert.equal(settingsSaveError([anil], 'Anil Sahu', '919876543210', '1'), null);
  });
});

describe('planMediatorSave', () => {
  it('links an existing name and number without inserting', () => {
    const plan = planMediatorSave({
      name: 'Anil sahu',
      phoneInput: '+91-98765-43210',
      saveToList: true,
      pickedId: null,
      list: [anil, yash],
    });
    assert.equal(plan.action, 'link');
    if (plan.action === 'link') assert.equal(plan.mediator.id, '1');
  });

  it('blocks a number saved under a different name when saving to the list', () => {
    const plan = planMediatorSave({
      name: 'Shop',
      phoneInput: '9876543210',
      saveToList: true,
      pickedId: null,
      list: [anil],
    });
    assert.equal(plan.action, 'blocked');
  });

  it('stores the number on the order only when save is unchecked', () => {
    const plan = planMediatorSave({
      name: 'Shop',
      phoneInput: '9876543210',
      saveToList: false,
      pickedId: null,
      list: [anil],
    });
    assert.deepEqual(plan, { action: 'order-only', name: 'Shop', phone: '919876543210' });
  });

  it('allows the same name with another number', () => {
    const plan = planMediatorSave({
      name: 'Anil Sahu',
      phoneInput: '9000011122',
      saveToList: true,
      pickedId: null,
      list: [anil],
    });
    assert.equal(plan.action, 'create');
  });

  it('keeps a picked contact linked when nothing changed', () => {
    const plan = planMediatorSave({
      name: 'Anil Sahu',
      phoneInput: '+91 98765 43210',
      saveToList: false,
      pickedId: '1',
      list: [anil],
    });
    assert.equal(plan.action, 'link');
  });
});
