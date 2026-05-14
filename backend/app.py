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
                return jsonify({"error": "Invalid token user"}), 401
        except Exception as e:
            return jsonify({"error": "Token is invalid"}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Missing email or password"}), 400
        
    user = db.users.find_one({"email": data["email"]})
    
    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
        
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
        "newThisMonth": 0, # Placeholder or calculate if date is available
        "occupiedRooms": occupied_rooms,
        "totalRooms": total_rooms,
        "monthlyRevenue": paid_residents * 1500,
        "latePayments": late_payments,
        "lateAmount": late_payments * 1500,
        "pendingReclamations": db.reclamations.count_documents({"status": {"$in": ["Ouvert", "En attente"]}})
    }
    
    recent_residents = list(db.residents.find().sort("_id", -1).limit(5))
    for r in recent_residents:
        serialize_doc(r)
        
    return jsonify({
        "stats": stats,
        "recentResidents": recent_residents
    }), 200

@app.route("/api/rooms", methods=["GET"])
@token_required
def get_rooms(current_user):
    rooms_data = list(db.rooms.find())
    floors_dict = {}
    
    for room in rooms_data:
        serialize_doc(room)
        floor = room.get("floor", "Rez-de-chaussée")
        if floor not in floors_dict:
            floors_dict[floor] = []
        floors_dict[floor].append(room)
        
    floors = []
    order = ["Rez-de-chaussée", "Étage 1", "Étage 2", "Étage 3", "Étage 4"]
    for name in order:
        if name in floors_dict:
            floors.append({"name": name, "rooms": floors_dict[name]})
            
    for name, rooms in floors_dict.items():
        if name not in order:
            floors.append({"name": name, "rooms": rooms})
            
    return jsonify(floors), 200

@app.route("/api/admin/generate-rooms", methods=["POST"])
@token_required
def generate_rooms(current_user):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
        
    # Check if rooms exist
    if db.rooms.count_documents({}) > 0:
        return jsonify({"message": "Rooms already exist. Drop them manually if you want to recreate."}), 400
        
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
    return jsonify({"message": f"{len(rooms_to_insert)} rooms generated successfully."}), 201

@app.route("/api/residents", methods=["GET", "POST"])
@token_required
def residents_api(current_user):
    if request.method == "POST":
        if current_user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
            
        data = request.json
        if not data or "email" not in data:
            return jsonify({"error": "No payload or email provided"}), 400
            
        # Create user account for resident
        if not db.users.find_one({"email": data["email"]}):
            db.users.insert_one({
                "email": data["email"],
                "password": generate_password_hash("Suptech2026!"),
                "role": "resident"
            })
        
        result = db.residents.insert_one(data)
        data["_id"] = str(result.inserted_id)
        
        room_id = data.get("room")
        if room_id:
            db.rooms.update_one(
                {"id": room_id},
                {"$set": {"status": "occ"}, "$push": {"residents": data.get("name")}}
            )
        
        db.stats.update_one({}, {"$inc": {"activeResidents": 1}})
        
        return jsonify(data), 201
        
    elif request.method == "GET":
        residents = list(db.residents.find().sort("_id", -1))
        for r in residents:
            serialize_doc(r)
        return jsonify(residents), 200

@app.route("/api/residents/<resident_id>", methods=["PUT", "DELETE"])
@token_required
def update_resident(current_user, resident_id):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
        
    old_res = db.residents.find_one({"_id": ObjectId(resident_id)})
    if not old_res:
        return jsonify({"error": "Not found"}), 404

    if request.method == "DELETE":
        if old_res.get("room"):
            db.rooms.update_one({"id": old_res.get("room")}, {"$pull": {"residents": old_res.get("name")}})
            room = db.rooms.find_one({"id": old_res.get("room")})
            if room and len(room.get("residents", [])) == 0:
                db.rooms.update_one({"id": old_res.get("room")}, {"$set": {"status": "free"}})
        
        db.residents.delete_one({"_id": ObjectId(resident_id)})
        db.users.delete_one({"email": old_res.get("email")})
        db.stats.update_one({}, {"$inc": {"activeResidents": -1}})
        return jsonify({"message": "Resident deleted"}), 200

    data = request.json
    old_room = old_res.get("room")
    new_room = data.get("room", old_room)
    
    if old_room != new_room:
        if old_room:
            db.rooms.update_one({"id": old_room}, {"$pull": {"residents": old_res.get("name")}})
            room = db.rooms.find_one({"id": old_room})
            if room and len(room.get("residents", [])) == 0:
                db.rooms.update_one({"id": old_room}, {"$set": {"status": "free"}})
                
        if new_room:
            db.rooms.update_one({"id": new_room}, {"$set": {"status": "occ"}, "$push": {"residents": data.get("name", old_res.get("name"))}})
    
    db.residents.update_one({"_id": ObjectId(resident_id)}, {"$set": data})
    return jsonify({"message": "Resident updated"}), 200

@app.route("/api/admin/register", methods=["POST"])
@token_required
def register_admin(current_user):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    data = request.json
    if not data or "email" not in data or "name" not in data:
        return jsonify({"error": "Missing fields"}), 400
    
    if db.users.find_one({"email": data["email"]}):
        return jsonify({"error": "Admin already exists"}), 400
        
    db.users.insert_one({
        "name": data["name"],
        "email": data["email"],
        "password": generate_password_hash("Admin2026!"),
        "role": "admin"
    })
    return jsonify({"message": "Admin created", "password": "Admin2026!"}), 201

@app.route("/api/admins", methods=["GET"])
@token_required
def get_admins(current_user):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    admins = list(db.users.find({"role": "admin"}, {"password": 0}))
    for a in admins:
        serialize_doc(a)
    return jsonify(admins), 200


@app.route("/api/user/password", methods=["PATCH"])
@token_required
def change_password(current_user):
    data = request.json
    if not data or "new_password" not in data:
        return jsonify({"error": "Missing new password"}), 400
        
    db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"password": generate_password_hash(data["new_password"])}}
    )
    return jsonify({"message": "Password updated"}), 200

@app.route("/api/reclamations", methods=["GET", "POST"])
@token_required
def reclamations_api(current_user):
    if request.method == "POST":
        data = request.json
        data["date"] = datetime.now().isoformat()
        data["status"] = "Ouvert"
        data["resident_email"] = current_user["email"]
        result = db.reclamations.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return jsonify(data), 201
    else:
        if current_user.get("role") == "admin":
            reclamations = list(db.reclamations.find().sort("_id", -1))
        else:
            reclamations = list(db.reclamations.find({"resident_email": current_user["email"]}).sort("_id", -1))
        for r in reclamations:
            serialize_doc(r)
        return jsonify(reclamations), 200

@app.route("/api/reclamations/<rec_id>", methods=["PUT"])
@token_required
def update_reclamation(current_user, rec_id):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    data = request.json
    
    update_fields = {}
    if "status" in data:
        update_fields["status"] = data["status"]
    if "reply" in data:
        update_fields["reply"] = data["reply"]
        
    db.reclamations.update_one({"_id": ObjectId(rec_id)}, {"$set": update_fields})
    
    # Send notification
    rec = db.reclamations.find_one({"_id": ObjectId(rec_id)})
    if rec and "resident_email" in rec:
        msg = f"Mise à jour sur votre réclamation: {rec.get('type')}."
        if "reply" in data:
            msg += " Un admin a répondu."
            
        db.notifications.insert_one({
            "email": rec["resident_email"],
            "message": msg,
            "read": False,
            "date": datetime.now().isoformat()
        })
    return jsonify({"message": "Reclamation updated"}), 200

@app.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    notifs = list(db.notifications.find({"email": current_user["email"]}).sort("_id", -1))
    for n in notifs:
        serialize_doc(n)
    return jsonify(notifs), 200

@app.route("/api/notifications/read", methods=["PUT"])
@token_required
def read_notifications(current_user):
    db.notifications.update_many(
        {"email": current_user["email"], "read": False},
        {"$set": {"read": True}}
    )
    return jsonify({"message": "Notifications marked as read"}), 200

@app.route("/api/user/notifications", methods=["DELETE"])
@token_required
def delete_notifications(current_user):
    db.notifications.delete_many({"email": current_user["email"]})
    return jsonify({"message": "Notifications deleted"}), 200

@app.route("/api/annonces", methods=["GET", "POST"])
@token_required
def annonces_api(current_user):
    if request.method == "POST":
        data = request.json
        if not data:
            return jsonify({"error": "No payload provided"}), 400
            
        # Get real name
        if current_user.get("role") == "admin":
            author_name = current_user.get("name", "Admin")
        else:
            resident = db.residents.find_one({"email": current_user["email"]})
            author_name = resident.get("name") if resident else "Résident Inconnu"
            
        data["author"] = author_name
        data["email"] = current_user["email"]
        data["time"] = datetime.now().isoformat()
        data["comments"] = []
        data["closed"] = False
            
        result = db.annonces.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return jsonify(data), 201
        
    elif request.method == "GET":
        annonces = list(db.annonces.find().sort("_id", -1))
        for a in annonces:
            serialize_doc(a)
        return jsonify(annonces), 200

@app.route("/api/annonces/<annonce_id>/comments", methods=["POST"])
@token_required
def comment_annonce(current_user, annonce_id):
    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "Missing comment text"}), 400
        
    if current_user.get("role") == "admin":
        author_name = current_user.get("name", "Admin")
    else:
        resident = db.residents.find_one({"email": current_user["email"]})
        author_name = resident.get("name") if resident else "Résident"
        
    comment = {
        "author": author_name,
        "text": data["text"],
        "time": datetime.now().isoformat()
    }
    
    result = db.annonces.update_one(
        {"_id": ObjectId(annonce_id), "closed": {"$ne": True}},
        {"$push": {"comments": comment}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Annonce not found or closed"}), 404
    return jsonify(comment), 201

@app.route("/api/annonces/<annonce_id>/close", methods=["PUT"])
@token_required
def close_annonce(current_user, annonce_id):
    annonce = db.annonces.find_one({"_id": ObjectId(annonce_id)})
    if not annonce:
        return jsonify({"error": "Annonce not found"}), 404
        
    if current_user.get("role") != "admin" and annonce.get("email") != current_user["email"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    db.annonces.update_one({"_id": ObjectId(annonce_id)}, {"$set": {"closed": True}})
    return jsonify({"message": "Annonce closed"}), 200

@app.route("/api/annonces/<annonce_id>", methods=["DELETE"])
@token_required
def delete_annonce(current_user, annonce_id):
    annonce = db.annonces.find_one({"_id": ObjectId(annonce_id)})
    if not annonce:
        return jsonify({"error": "Annonce not found"}), 404
        
    if current_user.get("role") != "admin" and annonce.get("email") != current_user["email"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    db.annonces.delete_one({"_id": ObjectId(annonce_id)})
    return jsonify({"message": "Annonce deleted"}), 200

@app.route("/api/activites", methods=["GET", "POST"])
@token_required
def activites_api(current_user):
    if request.method == "POST":
        data = request.json
        if not data:
            return jsonify({"error": "No data"}), 400
            
        data["date_created"] = datetime.now().isoformat()
        if current_user.get("role") == "admin":
            data["status"] = "approved"
        else:
            data["status"] = "pending"
            data["suggester_email"] = current_user["email"]
            
        result = db.activites.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return jsonify(data), 201
    else:
        if current_user.get("role") == "admin":
            acts = list(db.activites.find().sort("_id", -1))
        else:
            acts = list(db.activites.find({"status": "approved"}).sort("_id", -1))
        for a in acts:
            serialize_doc(a)
        return jsonify(acts), 200

@app.route("/api/activites/<act_id>/status", methods=["PUT"])
@token_required
def update_activity_status(current_user, act_id):
    if current_user.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.json
    status = data.get("status")
    comment = data.get("comment", "")
    
    act = db.activites.find_one({"_id": ObjectId(act_id)})
    if not act:
        return jsonify({"error": "Not found"}), 404
        
    db.activites.update_one({"_id": ObjectId(act_id)}, {"$set": {"status": status, "admin_comment": comment}})
    
    if "suggester_email" in act:
        msg = f"Votre suggestion d'activité '{act.get('title')}' a été {status}."
        if comment:
            msg += f" Commentaire: {comment}"
        db.notifications.insert_one({
            "email": act["suggester_email"],
            "message": msg,
            "read": False,
            "date": datetime.now().isoformat()
        })
        
    return jsonify({"message": f"Activity {status}"}), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)
