(() => {
  const roles = document.querySelectorAll('input[name=role]');
  const extra = document.querySelector('.investor-extra');
  const update = () => { if (extra) extra.hidden = document.querySelector('input[name=role]:checked')?.value !== 'investor'; };
  if (location.hash === '#investor') { const investor = document.querySelector('input[name=role][value=investor]'); if (investor) investor.checked = true; }
  roles.forEach(input => input.addEventListener('change', update));
  update();
  const form = document.querySelector('#register-form');
  if (form) {
    const configs = {
      startup: ['✳', 'Команда строит проект', 'Создавайте профиль стартапа, добавляйте цели и обновления, следите за оценкой ИИ и реакцией сообщества.', 'Создать проект', 'create.html'],
      investor: ['↗', 'Изучайте перспективные проекты', 'Следите за прогрессом команд, читайте объяснение оценки и связывайтесь с проектами.', 'Открыть каталог', 'projects.html'],
      mentor: ['✳', 'Поддерживайте команды экспертизой', 'Изучайте проекты, проверяйте ход работы и добавляйте наставническую оценку.', 'Открыть проекты', 'projects.html'],
    };
    const preview = () => { const values = configs[form.elements.role.value]; if (!values) return; const [glyph, title, description, action, href] = values; const get = id => document.getElementById(id); if (get('role-glyph')) get('role-glyph').textContent = glyph; if (get('role-title')) get('role-title').textContent = title; if (get('role-description')) get('role-description').textContent = description; if (get('role-action')) { get('role-action').textContent = `${action} ↗`; get('role-action').href = href; } };
    form.addEventListener('change', preview); preview();
  }
})();
