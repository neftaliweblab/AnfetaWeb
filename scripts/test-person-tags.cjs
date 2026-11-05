const PERSON_MAP = {
  Neftali: { active: 'nne11', templateRegex: /#?nn-e\d{2}\b/gi, activeRegex: /#?nne\d{2}\b/gi },
  Edwin: { active: 'eed11', templateRegex: /#?ee-d\d{2}\b/gi, activeRegex: /#?eed\d{2}\b/gi },
  John: { active: 'jjo11', templateRegex: /#?jj-o\d{2}\b/gi, activeRegex: /#?jjo\d{2}\b/gi },
  Karla: { active: 'kka11', templateRegex: /#?kk-a\d{2}\b/gi, activeRegex: /#?kka\d{2}\b/gi },
  Genaro: { active: 'gge11', templateRegex: /#?gg-e\d{2}\b/gi, activeRegex: /#?gge\d{2}\b/gi },
  Andrade: { active: 'aan11', templateRegex: /#?aa-n\d{2}\b/gi, activeRegex: /#?aan\d{2}\b/gi },
  Isai: { active: 'iis11', templateRegex: /#?ii-s\d{2}\b/gi, activeRegex: /#?iis\d{2}\b/gi },
  Brian: { active: 'bbr11', templateRegex: /#?bb-r\d{2}\b/gi, activeRegex: /#?bbr\d{2}\b/gi },
};

function activatePersonTag(tags, personName, cleanOthers = false) {
  let result = tags || '';
  const entry = PERSON_MAP[personName];
  if (!entry) return result;

  // 1. If person has template tag, replace it with active tag
  if (entry.templateRegex.test(result)) {
    result = result.replace(entry.templateRegex, entry.active);
  } else if (!entry.activeRegex.test(result)) {
    result = (result + ' ' + entry.active).trim();
  }

  // 2. If cleanOthers is true, remove all template tags of other people
  if (cleanOthers) {
    for (const [name, other] of Object.entries(PERSON_MAP)) {
      if (name !== personName) {
        result = result.replace(other.templateRegex, '');
        result = result.replace(other.activeRegex, '');
      }
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

function cleanInactiveTags(tags, activePerson) {
  let result = tags || '';
  for (const [name, other] of Object.entries(PERSON_MAP)) {
    if (name !== activePerson) {
      result = result.replace(other.templateRegex, '');
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

const input = '#descripcion #ffase00 #nn-e11 #aa-n11 #ee-d11 #gg-e11 #ii-s11 #jj-o11 #kk-a11';
console.log('Original:        ', input);
console.log('Neftali (keep):  ', activatePersonTag(input, 'Neftali', false));
console.log('Neftali (clean): ', activatePersonTag(input, 'Neftali', true));
console.log('Clean inactives: ', cleanInactiveTags(activatePersonTag(input, 'Neftali', false), 'Neftali'));
