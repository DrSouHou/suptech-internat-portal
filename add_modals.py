from bs4 import BeautifulSoup

with open('index.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')

# Add Name to modal-admin
admin_email_field = soup.select_one('#modal-admin .form-grid .form-field')
if admin_email_field and not soup.find(id='new-admin-name'):
    name_field = BeautifulSoup('''
    <div class="form-field full"><label>Nom Complet</label><input type="text" id="new-admin-name" required></div>
    ''', 'html.parser')
    admin_email_field.insert_before(name_field)

# Add modal-repondre-rec
if not soup.find(id='modal-repondre-rec'):
    modal_html = '''
    <div class="modal-overlay" id="modal-repondre-rec">
      <div class="modal glass-panel">
        <div class="modal-title">Répondre à la réclamation<span class="modal-close" onclick="closeModal('repondre-rec')">&times;</span></div>
        <form onsubmit="event.preventDefault(); submitReclamationReply();">
          <input type="hidden" id="reply-rec-id">
          <div class="form-grid">
            <div class="form-field full">
              <label>Message / Réponse</label>
              <textarea id="reply-rec-msg" rows="4" required></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-outline" onclick="closeModal('repondre-rec')">Annuler</button>
            <button type="submit" class="btn-primary btn-gradient">Envoyer</button>
          </div>
        </form>
      </div>
    </div>
    '''
    soup.body.append(BeautifulSoup(modal_html, 'html.parser'))

# Add modal-suggest-activity
if not soup.find(id='modal-suggest-activity'):
    modal_html = '''
    <div class="modal-overlay" id="modal-suggest-activity">
      <div class="modal glass-panel">
        <div class="modal-title">Nouvelle Activité<span class="modal-close" onclick="closeModal('suggest-activity')">&times;</span></div>
        <form onsubmit="event.preventDefault(); submitActivity();">
          <div class="form-grid">
            <div class="form-field full"><label>Titre</label><input type="text" id="act-title" required></div>
            <div class="form-field"><label>Date (ex: 15 Juin 2025)</label><input type="text" id="act-date" required></div>
            <div class="form-field"><label>Lieu</label><input id="act-desc" required="" type="text" /></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-outline" onclick="closeModal('suggest-activity')">Annuler</button>
            <button type="submit" class="btn-primary btn-gradient">Soumettre</button>
          </div>
        </form>
      </div>
    </div>
    '''
    soup.body.append(BeautifulSoup(modal_html, 'html.parser'))

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(str(soup))
