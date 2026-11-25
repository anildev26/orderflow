import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterMediators, followUpMediatorPhone, mergeMediatorSuggestions, planMediatorSave, settingsSaveError, type MediatorRecord } from './mediators.ts';

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

const saloni: MediatorRecord = {
  id: '3',
  name: 'Saloni Selvan',
  nameKey: 'saloni selvan',
  phoneDisplay: '+91 98765 43210',
  phoneNormalized: '919876543210',
};
const saloniOther: MediatorRecord = {
  id: '4',
  name: 'Saloni Selvan',
  nameKey: 'saloni selvan',
  phoneDisplay: '+91 90000 11122',
  phoneNormalized: '919000011122',
};

describe('followUpMediatorPhone', () => {
  it('uses the linked mediator number, adding 91 when it is only 10 digits', () => {
    const tenDigit: MediatorRecord = { ...anil, id: 'linked', phoneNormalized: '9876543210' };
    assert.equal(followUpMediatorPhone({ mediatorId: 'linked', mediatorName: 'Someone else' }, [tenDigit, yash]), '919876543210');
  });

  it('matches a saved name when the order is not linked', () => {
    assert.equal(followUpMediatorPhone({ mediatorId: null, mediatorName: '  ANIL   sahu ' }, [yash, anil]), '919876543210');
  });

  it('returns null when the saved mediator has no number', () => {
    assert.equal(followUpMediatorPhone({ mediatorId: '2', mediatorName: 'Yash' }, [yash]), null);
    assert.equal(followUpMediatorPhone({ mediatorId: null, mediatorName: 'Unknown' }, [anil]), null);
  });
});

describe('filterMediators', () => {
  const list = [saloni, yash];

  it('matches a name substring and does not treat a letter query as a phone', () => {
    assert.deepEqual(filterMediators(list, 'sel').map((m) => m.id), ['3']);
    assert.deepEqual(filterMediators(list, '  SAL ').map((m) => m.id), ['3']);
    assert.deepEqual(filterMediators([yash], 'zzz'), []);
  });

  it('matches a phone only when the query contains digits', () => {
    assert.deepEqual(filterMediators(list, '98765').map((m) => m.id), ['3']);
    assert.deepEqual(filterMediators(list, '00000'), []);
  });

  it('returns the full list when the query is empty', () => {
    assert.equal(filterMediators(list, '  ').length, 2);
  });
});

describe('mergeMediatorSuggestions', () => {
  it('prefers the saved contact, including its phone and id', () => {
    const merged = mergeMediatorSuggestions([saloni], ['saloni   selvan', 'Yash']);
    const saved = merged.find((m) => m.nameKey === 'saloni selvan');
    const orderOnly = merged.find((m) => m.nameKey === 'yash');
    assert.equal(saved?.id, '3');
    assert.equal(saved?.phoneDisplay, '+91 98765 43210');
    assert.equal(orderOnly?.id, null);
    assert.equal(orderOnly?.phoneDisplay, '');
    assert.equal(orderOnly?.phoneNormalized, '');
  });

  it('keeps two saved numbers for one name and drops the order copy', () => {
    const merged = mergeMediatorSuggestions([saloni, saloniOther], ['Saloni Selvan']);
    assert.deepEqual(merged.map((m) => m.id), ['4', '3']);
  });

  it('keeps the first spelling of an order-only name', () => {
    const merged = mergeMediatorSuggestions([], ['  YASH  ', 'yash']);
    assert.deepEqual(merged, [{
      id: null,
      name: 'YASH',
      nameKey: 'yash',
      phoneDisplay: '',
      phoneNormalized: '',
    }]);
  });
});
