import mongoose, {
  Schema,
  model,
  models,
  Document,
  Model,
} from "mongoose";
import bcrypt from "bcryptjs";

/* =========================
   1️⃣ Interface Definition
========================= */

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "ADMIN" | "MANAGER" | "USER";
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;

  comparePassword(password: string): Promise<boolean>;
}

/* =========================
   2️⃣ Schema Definition
========================= */

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // 🔐 never returned by default
    },

    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "USER"],
      default: "USER",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   3️⃣ Pre-Save Hook (Hash Password)
========================= */

UserSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/* =========================
   4️⃣ Instance Method (Password Compare)
========================= */

UserSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

/* =========================
   5️⃣ Safe Model Export (Prevents Recompile Error)
========================= */

const User: Model<IUser> =
  models.User || model<IUser>("User", UserSchema);

export default User;