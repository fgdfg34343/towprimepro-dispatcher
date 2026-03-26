import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebaseConfig";

function normalizePassword(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string;
  onConfirm: (comment: string) => Promise<void>;
}

const CancelOrderDialog = ({
  open,
  onOpenChange,
  orderCode,
  onConfirm,
}: CancelOrderDialogProps) => {
  const [comment, setComment] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setComment("");
    setPassword("");
    setPasswordError(false);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    const normalizedPassword = normalizePassword(password);

    if (!comment.trim()) {
      toast.error("Укажите причину завершения заявки");
      return;
    }

    if (!normalizedPassword) {
      toast.error("Введите пароль диспетчера");
      return;
    }

    setPasswordError(false);
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Не авторизован");
      const credential = EmailAuthProvider.credential(user.email, normalizedPassword);
      await reauthenticateWithCredential(user, credential);
      await onConfirm(comment.trim());
      toast.success("Заявка завершена диспетчером");
      handleClose();
    } catch (error: any) {
      if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password") {
        setPasswordError(true);
        toast.error("Неверный пароль диспетчера");
      } else {
        console.error("Ошибка завершения заявки:", error);
        toast.error("Не удалось завершить заявку");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Завершить заявку {orderCode}
          </DialogTitle>
          <DialogDescription>
            Это действие изменит статус заявки на «Отменена» и не может быть
            легко отменено. Укажите причину и подтвердите паролем.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Причина */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Причина завершения
            </label>
          <Textarea
              placeholder="Например: клиент отказался, водитель сломался, клиент не выходит на связь..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              className="resize-none min-h-[100px]"
              maxLength={500}
              autoComplete="off"
              name="cancel-comment"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Пароль */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Пароль диспетчера
            </label>
            {/* Скрытый инпут чтобы обмануть Chrome autofill */}
            <input type="text" style={{ display: "none" }} autoComplete="username" readOnly />
            <Input
              type="password"
              placeholder="Введите пароль для подтверждения"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(false);
              }}
              disabled={submitting}
              autoComplete="new-password"
              name="dispatcher-cancel-pwd"
              className={passwordError ? "border-destructive focus-visible:ring-destructive" : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
            />
            {passwordError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Неверный пароль
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !comment.trim() || !password}
          >
            {submitting ? "Завершаем..." : "Завершить заявку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelOrderDialog;
