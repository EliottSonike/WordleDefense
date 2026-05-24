# Déploiement du bot Tower Defense

## 1. Créer le bot Discord

1. Allez sur https://discord.com/developers/applications
2. **New Application** → donnez un nom (ex : "Tower Defense")
3. Onglet **Bot** → **Add Bot** → **Reset Token** → copiez le token
4. Sous "Privileged Gateway Intents" : activez **MESSAGE CONTENT INTENT**
5. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot`
   - Bot Permissions : `Send Messages`, `Attach Files`, `Read Message History`
6. Copiez l'URL générée, ouvrez-la dans votre navigateur et invitez le bot sur votre serveur

---

## 2. Préparer le serveur Linux (Ubuntu/Debian)

```bash
# Java 21
sudo apt update
sudo apt install -y openjdk-21-jdk curl

# Créer l'utilisateur et le dossier
sudo useradd -r -s /bin/false towerdefense
sudo mkdir -p /opt/towerdefense
```

---

## 3. Transférer les fichiers

Depuis votre PC Windows (dans le dossier du projet) :

```powershell
# Adapter l'adresse IP et le nom d'utilisateur SSH de votre serveur
scp -r src resources config.properties build.sh VOTRE_USER@IP_SERVEUR:/opt/towerdefense/
```

---

## 4. Compiler sur le serveur

```bash
ssh VOTRE_USER@IP_SERVEUR
cd /opt/towerdefense
chmod +x build.sh
./build.sh
# → Télécharge JDA (~15 Mo) et compile
```

---

## 5. Configurer le token

```bash
nano /opt/towerdefense/config.properties
# Remplacez VOTRE_TOKEN_ICI par le token copié à l'étape 1
```

---

## 6. Tester le bot manuellement

```bash
cd /opt/towerdefense
java -Djava.awt.headless=true -cp "out:lib/JDA-5.2.1-withDependencies.jar" DiscordBot
# Ctrl+C pour arrêter après vérification
```

---

## 7. Installer le service systemd

```bash
# Copier le fichier de service
sudo cp /opt/towerdefense/towerdefense.service /etc/systemd/system/

# Donner les permissions à l'utilisateur du service
sudo chown -R towerdefense:towerdefense /opt/towerdefense

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable towerdefense
sudo systemctl start towerdefense

# Vérifier l'état
sudo systemctl status towerdefense

# Voir les logs en direct
sudo journalctl -u towerdefense -f
```

---

## Commandes du bot (dans un salon Discord)

| Commande | Description |
|---|---|
| `!td commencer` | Nouvelle partie (niveau 1) |
| `!td commencer 2` | Niveau 2 |
| `!td invoque` | Tire une lettre-tour (10 💰) |
| `!td info` | Inventaire, PV, or, phase |
| `!td poser 0 3` | Pose la lettre nº0 sur la case nº3 |
| `!td vague` | Lance la prochaine vague |
| `!td carte` | Affiche la carte maintenant |
| `!td bonus FEU` | Active le bonus BOOST_FEU |
| `!td stop` | Abandonne la partie |
| `!td aide` | Aide complète |

Les numéros des cases constructibles apparaissent **en jaune** sur la carte.
La carte se met à jour automatiquement toutes les **5 secondes** pendant une vague.

---

## Mise à jour du code

```bash
# Transférer les nouveaux fichiers src/ depuis Windows
scp -r src/ VOTRE_USER@IP_SERVEUR:/opt/towerdefense/

# Sur le serveur : recompiler et redémarrer
cd /opt/towerdefense && ./build.sh
sudo systemctl restart towerdefense
```
