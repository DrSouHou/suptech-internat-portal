import os
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://internat-638ln.ondigitalocean.app"])

app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "super-secret-key")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client.suptech_internat_db

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def init_db():
    if db.users.count_documents({}) == 0:
        db.users.insert_many([
            {
                "email": "admin@suptech.ma",
                "password": generate_password_hash("adminpassword"),
                "role": "admin"
            },
            {
                "email": "resident47@suptech.ma",
                "password": generate_password_hash("residentpassword"),
                "role": "resident"
            }
        ])
    if db.rooms.count_documents({}) == 0:
        rooms_to_insert = []
        floors = ["Rez-de-chaussée", "Étage 1", "Étage 2", "Étage 3", "Étage 4"]
        for f_idx, floor in enumerate(floors):
            prefix = str(f_idx) if f_idx > 0 else "0"
            for i in range(1, 101):
                room_id = f"{prefix}{i:02d}"
                room_type = "D" if i <= 80 else "I"
                rooms_to_insert.append({
                    "floor": floor,
                    "id": room_id,
                    "status": "free",
                    "type": room_type,
                    "residents": []
                })
        db.rooms.insert_many(rooms_to_insert)
    if db.residents.count_documents({}) == 0:
        db.residents.insert_many([
            {"initials": "FZ", "name": "Fatima Zahra Idrissi", "school": "Suptech Info Santé", "room": "101", "roomType": "Indiv.", "status": "Payé", "score": 92, "bg": ""},
            {"initials": "MA", "name": "Mehdi Alaoui", "school": "Suptech Info Santé", "room": "204", "roomType": "Double", "status": "Retard", "score": 58, "bg": "var(--accent-warm)"}
        ])
    if db.stats.count_documents({}) == 0:
        db.stats.insert_one({
            "activeResidents": 47,
            "newThisMonth": 3,
            "occupiedRooms": 38,
            "totalRooms": 50,
            "monthlyRevenue": 52500,
            "latePayments": 5,
            "lateAmount": 7500
        })
    if db.annonces.count_documents({}) == 0:
        db.annonces.insert_many([
            {"author": "Fatima Z.", "time": "Il y a 2h", "content": "Quelqu'un a un chargeur de Macbook à prêter pour la soirée ?"},
            {"author": "Mehdi A.", "time": "Il y a 5h", "content": "Je vends mon écran PC 24 pouces, DM moi !"}
        ])
    if db.reclamations.count_documents({}) == 0:
        db.reclamations.insert_many([
            {"resident_name": "Fatima Zahra Idrissi", "resident_email": "resident47@suptech.ma", "type": "Plomberie", "description": "Fuite d'eau", "status": "Ouvert", "date": datetime.now().isoformat()},
            {"resident_name": "Mehdi Alaoui", "resident_email": "mehdi@suptech.ma", "type": "Électricité", "description": "Plus de lumière", "status": "Résolu", "date": datetime.now().isoformat()}
        ])
    if db.notifications.count_documents({}) == 0:
        db.notifications.insert_many([
            {"email": "resident47@suptech.ma", "message": "Votre réclamation a été reçue.", "read": False, "date": datetime.now().isoformat()}
        ])

try:
    init_db()
except Exception as e:
    print(f"Warning: Could not connect to MongoDB for initialization. Is it running? Error: {e}")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            parts = request.headers["Authorization"].split()
            if len(parts) == 2 and parts[0] == "Bearer":
                token = parts[1]
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
            
        try:
            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            current_user = db.users.find_one({"email": data["email"]})
            if not current_user:
                 return jsonify({"error": "User not found"}), 401
        except Exception:
            return jsonify({"error": "Token is invalid"}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Données JSON manquantes"}), 400
        
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"error": "Email et mot de passe requis"}), 400
            
        user = db.users.find_one({"email": email})
        
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Identifiants invalides"}), 401
            
        token = jwt.encode({
            "email": user["email"],
            "role": user.get("role", "resident"),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }, app.config["SECRET_KEY"], algorithm="HS256")
        
        return jsonify({
            "token": token,
            "role": user.get("role", "resident"),
            "email": user["email"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/user/profile", methods=["GET"])
@token_required
def get_user_profile(current_user):
    if current_user.get("role") == "admin":
        return jsonify({"name": current_user.get("name", "Admin"), "role": "admin", "email": current_user["email"]}), 200
    
    resident = db.residents.find_one({"email": current_user["email"]})
    if resident:
        serialize_doc(resident)
        return jsonify(resident), 200
    return jsonify({"error": "Resident profile not found"}), 404

@app.route("/api/dashboard", methods=["GET"])
@token_required
def get_dashboard(current_user):
    # Dynamically calculate stats
    active_residents = db.residents.count_documents({})
    occupied_rooms = db.rooms.count_documents({"status": "occ"})
    total_rooms = db.rooms.count_documents({})
    late_payments = db.residents.count_documents({"status": "Retard"})
    paid_residents = db.residents.count_documents({"status": "Payé"})
    
    stats = {
        "activeResidents": active_residents,
        "newThisMonth": 3,
        "occupiedRooms": occupied_rooms,
        "totalRooms": total_rooms,
        "monthlyRevenue": paid_residents * 1500,
        "latePayments": late_payments,
        "lateAmount": late_payments * 1500
    }
    return jsonify(stats), 200

@app.route("/api/residents", methods=["GET", "POST"])
@token_required
def manage_residents(current_user):
    if request.method == "GET":
        residents = list(db.residents.find({}))
        for res in residents:
            serialize_doc(res)
        return jsonify(residents), 200
    
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
        
    data = request.json
    new_resident = {
        "initials": data["prenom"][0] + data["nom"][0],
        "name": f"{data['prenom']} {data['nom']}",
        "email": data["email"],
        "school": data["ecole"],
        "room": data["room"],
        "roomType": data["type"],
        "status": "Payé",
        "score": 100,
        "bg": "",
        "date_entree": data.get("date", datetime.now().isoformat())
    }
    db.residents.insert_one(new_resident)
    # Mark room as occupied
    db.rooms.update_one({"id": data["room"]}, {"$set": {"status": "occ"}, "$push": {"residents": new_resident["name"]}})
    
    # Create user account
    db.users.insert_one({
        "email": data["email"],
        "password": generate_password_hash("residentpassword"),
        "role": "resident"
    })
    
    return jsonify({"message": "Resident added successfully"}), 201

@app.route("/api/rooms", methods=["GET"])
@token_required
def get_rooms(current_user):
    rooms = list(db.rooms.find({}))
    for r in rooms:
        serialize_doc(r)
    return jsonify(rooms), 200

@app.route("/api/reclamations", methods=["GET", "POST"])
@token_required
def manage_reclamations(current_user):
    if request.method == "GET":
        if current_user.get("role") == "admin":
            recs = list(db.reclamations.find({}))
        else:
            recs = list(db.reclamations.find({"resident_email": current_user["email"]}))
        for r in recs:
            serialize_doc(r)
        return jsonify(recs), 200
        
    data = request.json
    new_rec = {
        "resident_name": current_user.get("name", current_user["email"]),
        "resident_email": current_user["email"],
        "type": data["type"],
        "description": data["description"],
        "status": "Ouvert",
        "date": datetime.now().isoformat()
    }
    db.reclamations.insert_one(new_rec)
    return jsonify({"message": "Reclamation submitted"}), 201

@app.route("/api/reclamations/<id>/status", methods=["PATCH"])
@token_required
def update_reclamation_status(current_user, id):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    data = request.json
    db.reclamations.update_one({"_id": ObjectId(id)}, {"$set": {"status": data["status"]}})
    return jsonify({"message": "Status updated"}), 200

@app.route("/api/annonces", methods=["GET", "POST"])
@token_required
def manage_annonces(current_user):
    if request.method == "GET":
        ans = list(db.annonces.find({}))
        for a in ans:
            serialize_doc(a)
        return jsonify(ans), 200
    
    data = request.json
    new_an = {
        "author": current_user.get("name", current_user["email"]),
        "time": "À l'instant",
        "content": data["content"],
        "category": data.get("category", "Général")
    }
    db.annonces.insert_one(new_an)
    return jsonify({"message": "Annonce publiée"}), 201

@app.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    notifs = list(db.notifications.find({"email": current_user["email"]}))
    for n in notifs:
        serialize_doc(n)
    return jsonify(notifs), 200

@app.route("/api/notifications/delete-all", methods=["DELETE"])
@token_required
def delete_notifications(current_user):
    db.notifications.delete_many({"email": current_user["email"]})
    return jsonify({"message": "All notifications deleted"}), 200

@app.route("/api/admins", methods=["GET", "POST"])
@token_required
def manage_admins(current_user):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    if request.method == "GET":
        admins = list(db.users.find({"role": "admin"}, {"password": 0}))
        for a in admins:
            serialize_doc(a)
        return jsonify(admins), 200
        
    data = request.json
    db.users.insert_one({
        "email": data["email"],
        "name": data.get("name", "Admin"),
        "password": generate_password_hash("adminpassword"),
        "role": "admin"
    })
    return jsonify({"message": "Admin added"}), 201

@app.route("/api/auth/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    data = request.json
    new_pass = generate_password_hash(data["new_password"])
    db.users.update_one({"email": current_user["email"]}, {"$set": {"password": new_pass}})
    return jsonify({"message": "Password updated"}), 200

@app.route("/api/activities", methods=["GET", "POST"])
@token_required
def manage_activities(current_user):
    if request.method == "GET":
        acts = list(db.activities.find({}))
        for a in acts:
            serialize_doc(a)
        return jsonify(acts), 200
    
    data = request.json
    new_act = {
        "title": data["title"],
        "date": data["date"],
        "location": data.get("location", "Internat"),
        "status": "En attente" if current_user["role"] == "resident" else "Publié",
        "suggester_email": current_user["email"]
    }
    db.activities.insert_one(new_act)
    return jsonify({"message": "Activity suggested"}), 201

@app.route("/api/activities/<id>/status", methods=["PATCH"])
@token_required
def update_activity_status(current_user, id):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    data = request.json
    status = data["status"]
    db.activities.update_one({"_id": ObjectId(id)}, {"$set": {"status": status}})
    
    # Notify suggester
    act = db.activities.find_one({"_id": ObjectId(id)})
    if act and "suggester_email" in act:
        msg = f"Votre activité '{act['title']}' a été {status.lower()}."
        db.notifications.insert_one({
            "email": act["suggester_email"],
            "message": msg,
            "read": False,
            "date": datetime.now().isoformat()
        })
        
    return jsonify({"message": f"Activity {status}"}), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)
