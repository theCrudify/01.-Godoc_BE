import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./auth.service";

export const loginUserGodoc = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, token, cookieMaxAge } = await service.login(req.body);

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieMaxAge,
    });
    res.status(200).json({ data, token });
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Login error:", error.message, error.stack);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
