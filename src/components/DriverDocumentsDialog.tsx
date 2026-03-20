import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, ZoomIn, CheckCircle, XCircle, Edit } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebaseConfig";

interface DocumentInfo {
  type: string;
  status: string;
  imageUrl?: string;
  imagePath?: string;
  uploadedAt?: Date;
}

import { type DocumentData } from "firebase/firestore";

interface DriverDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  driverId: string;
  documents: Record<string, any> | null;
  driverData?: DocumentData;
  onVerify?: () => void;
  onReject?: (reason: string) => void;
  onRequestCorrection?: (reason: string) => void;
  onDriverUpdate?: () => void;
}

const DriverDocumentsDialog = ({
  open,
  onOpenChange,
  driverName,
  driverId,
  documents,
  driverData,
  onVerify,
  onReject,
  onRequestCorrection,
  onDriverUpdate,
}: DriverDocumentsDialogProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(new Map());

  // Загрузка изображений из Firebase Storage
  useEffect(() => {
    const loadImages = async () => {
      if (!documents) return;

      console.log("[Documents] Загрузка изображений, документы:", documents);
      const newLoadedImages = new Map<string, string>();

      for (const [key, doc] of Object.entries(documents)) {
        if (doc && typeof doc === "object") {
          console.log(`[Documents] Обработка документа ${key}:`, doc);

          // Обработка многостраничных документов (Page1, Page2)
          const pages = [];

          // Проверяем Page1
          if (doc.imageUrlPage1 || doc.imagePathPage1) {
            pages.push({
              suffix: "_page1",
              url: doc.imageUrlPage1,
              path: doc.imagePathPage1,
              pageNum: 1
            });
          }

          // Проверяем Page2
          if (doc.imageUrlPage2 || doc.imagePathPage2) {
            pages.push({
              suffix: "_page2",
              url: doc.imageUrlPage2,
              path: doc.imagePathPage2,
              pageNum: 2
            });
          }

          // Если нет страниц, проверяем обычные поля
          if (pages.length === 0) {
            pages.push({
              suffix: "",
              url: doc.imageUrl || doc.url || doc.downloadURL,
              path: doc.imagePath || doc.path || doc.filePath || doc.storagePath,
              pageNum: null
            });
          }

          // Обрабатываем каждую страницу
          for (const page of pages) {
            const mapKey = key + page.suffix;

            // Сначала проверяем прямой URL
            if (page.url && (page.url.startsWith("http://") || page.url.startsWith("https://"))) {
              console.log(`[Documents] Найден прямой URL для ${mapKey}:`, page.url);
              newLoadedImages.set(mapKey, page.url);
              continue;
            }

            // Затем пытаемся загрузить из Storage по пути
            if (page.path) {
              try {
                console.log(`[Documents] Загрузка из Storage для ${mapKey}, путь:`, page.path);
                const storageRef = ref(storage, page.path);
                const url = await getDownloadURL(storageRef);
                console.log(`[Documents] Успешно загружено для ${mapKey}:`, url);
                newLoadedImages.set(mapKey, url);
              } catch (error) {
                console.error(`❌ [Documents] Ошибка загрузки ${mapKey} из ${page.path}:`, error);
              }
            } else {
              console.warn(`⚠️ [Documents] Нет пути или URL для ${mapKey}`);
            }
          }
        }
      }

      console.log("[Documents] Загружено изображений:", newLoadedImages.size);
      setLoadedImages(newLoadedImages);
    };

    if (open) {
      loadImages();
    }
  }, [documents, open, driverId]);

  // Парсим документы из Firebase
  const parseDocuments = (): DocumentInfo[] => {
    if (!documents) return [];

    const docs: DocumentInfo[] = [];

    // Ожидаемые типы документов
    const docTypes = [
      { key: "driverLicense", name: "Водительское удостоверение" },
      { key: "carRegistration", name: "Свидетельство о регистрации ТС (СТС)" },
      { key: "vehicleRegistration", name: "Свидетельство о регистрации ТС (СТС)" }, // Альтернативное название
      { key: "carPhoto", name: "Фото автомобиля" },
      { key: "passport", name: "Паспорт" },
      { key: "insurance", name: "Страховка" },
      { key: "selfEmployedStatus", name: "Статус СЗ / ИП" },
      { key: "agencyContract", name: "Агентский договор" },
      { key: "taxId", name: "ИНН" },
    ];

    for (const docType of docTypes) {
      const doc = documents[docType.key];
      if (doc) {
        const imagePath = doc.imagePath || doc.path || doc.filePath || doc.imagePathPage1;
        const imageUrl = loadedImages.get(docType.key) ||
          doc.imageUrl || doc.url ||
          doc.imageUrlPage1 || doc.imageUrlPage2 ||
          doc.imageUrl1 || doc.imageUrl2 || "";

        // Если есть несколько страниц (page1, page2), создаем отдельные записи
        if (doc.imageUrlPage1 || doc.imageUrlPage2) {
          // Страница 1
          if (doc.imageUrlPage1) {
            docs.push({
              type: `${docType.name} (стр. 1)`,
              status: doc.status || "pending",
              imageUrl: loadedImages.get(docType.key + "_page1") || doc.imageUrlPage1,
              imagePath: doc.imagePathPage1,
              uploadedAt: doc.uploadedAt?.toDate?.() || null,
            });
          }

          // Страница 2
          if (doc.imageUrlPage2) {
            docs.push({
              type: `${docType.name} (стр. 2)`,
              status: doc.status || "pending",
              imageUrl: loadedImages.get(docType.key + "_page2") || doc.imageUrlPage2,
              imagePath: doc.imagePathPage2,
              uploadedAt: doc.uploadedAt?.toDate?.() || null,
            });
          }
        } else {
          // Обычный документ (одна страница)
          docs.push({
            type: docType.name,
            status: doc.status || "pending",
            imageUrl: imageUrl,
            imagePath: imagePath,
            uploadedAt: doc.uploadedAt?.toDate?.() || null,
          });
        }
      }
    }

    return docs;
  };

  const documentsList = parseDocuments();

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
      case "verified":
      case "подтвержден":
        return (
          <Badge className="bg-green-500 text-white border-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            Одобрено
          </Badge>
        );
      case "rejected":
      case "declined":
      case "отклонен":
        return (
          <Badge className="bg-red-500 text-white border-0">
            <XCircle className="w-3 h-3 mr-1" />
            Отклонено
          </Badge>
        );
      case "correction_required":
      case "требует_доработки":
        return (
          <Badge className="bg-orange-500 text-white border-0">
            <Edit className="w-3 h-3 mr-1" />
            Требует доработки
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            На проверке
          </Badge>
        );
    }
  };

  const handleRejectConfirm = () => {
    if (rejectReason.trim() && onReject) {
      onReject(rejectReason.trim());
      setRejectDialogOpen(false);
      setRejectReason("");
      onOpenChange(false);
    }
  };

  const handleCorrectionConfirm = () => {
    if (correctionReason.trim() && onRequestCorrection) {
      onRequestCorrection(correctionReason.trim());
      setCorrectionDialogOpen(false);
      setCorrectionReason("");
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">Документы водителя</DialogTitle>
            <DialogDescription>{driverName}</DialogDescription>
          </DialogHeader>

          {driverData?.verificationStatus === 'rejected' && driverData?.rejectionReason && (
            <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-md flex gap-3 items-start text-red-800">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <h4 className="font-semibold text-sm">Верификация отклонена</h4>
                <p className="text-sm mt-1 whitespace-pre-wrap">{driverData.rejectionReason}</p>
              </div>
            </div>
          )}

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 mb-6">
              {/* 1. Информация о водителе */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="w-5 h-5 rounded-full flex items-center justify-center p-0 text-xs">1</Badge>
                  Информация о водителе
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-muted-foreground block text-xs mb-1">ФИО</label>
                    <div className="font-medium">{driverName}</div>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-xs mb-1">ID водителя</label>
                    <div className="font-mono bg-muted px-2 py-0.5 rounded text-xs inline-block">{driverId}</div>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-xs mb-1">Телефон</label>
                    <div className="font-medium">{driverData?.phoneNumber || "Не указан"}</div>
                  </div>
                </div>
              </div>

              {/* 2. Статус исполнителя / ИНН */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="w-5 h-5 rounded-full flex items-center justify-center p-0 text-xs">2</Badge>
                  Статус исполнителя / ИНН
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-muted-foreground block text-xs mb-1">Тип занятости</label>
                    <div className="font-medium">
                      {(driverData?.documents?.selfEmployedStatus?.status === 'approved' || driverData?.isSelfEmployed)
                        ? (driverData?.employmentType || "Самозанятый / ИП")
                        : "Не подтверждено"}
                    </div>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-xs mb-1">ИНН</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{driverData?.taxId || driverData?.inn || "Не указан"}</span>
                        {driverData?.inn_verified ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white border-0 text-[10px] h-5">
                            Подтверждено
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-[10px] h-5">
                            Не подтверждено
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Агентский договор */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="w-5 h-5 rounded-full flex items-center justify-center p-0 text-xs">3</Badge>
                  Агентский договор
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Электронная версия договора
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const contractUrl = documents?.agencyContract?.imageUrl || documents?.agencyContract?.url || "#";
                      if (contractUrl !== "#") {
                        window.open(contractUrl, "_blank");
                      } else {
                        // Fallback toast if needed, but 'toast' might be undefined if I removed import.
                        // Check if toast is imported. Step 126 line 1 is empty, line 2 is react imports.
                        // I removed toast import in Step 123.
                        // I should ALERT or console log, or preferably re-add toast import.
                        // For now, simple alert or console.
                        console.log("Ссылка на договор не найдена");
                        alert("Ссылка на договор не найдена");
                      }
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Открыть договор
                  </Button>
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Badge variant="outline" className="w-5 h-5 rounded-full flex items-center justify-center p-0 text-xs">4</Badge>
              Документы
            </h3>

            {documentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Документы не загружены
                </h3>
                <p className="text-sm text-muted-foreground">
                  Водитель еще не загрузил документы для верификации
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documentsList.map((doc, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg overflow-hidden flex flex-col hover:border-primary/40 transition-colors bg-card"
                  >
                    {/* Image with overlay Actions */}
                    <div className="relative aspect-square w-full bg-muted group">
                      {doc.imageUrl ? (
                        <>
                          <img
                            src={doc.imageUrl}
                            alt={doc.type}
                            className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                            onClick={() => setSelectedImage(doc.imageUrl || null)}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedImage(doc.imageUrl || null)
                                }}
                                title="Увеличить"
                              >
                                <ZoomIn className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(doc.imageUrl, "_blank")
                                }}
                                title="Скачать"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                          <FileText className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-[10px] leading-tight">Нет фото</span>
                        </div>
                      )}

                      {/* Status Badge Absolute */}
                      <div className="absolute top-2 right-2 pointer-events-none">
                        {getStatusBadge(doc.status)}
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-3 text-xs flex-1 flex flex-col justify-end border-t border-border/50">
                      <h4 className="font-semibold mb-1 line-clamp-2 leading-tight" title={doc.type}>
                        {doc.type}
                      </h4>
                      {doc.uploadedAt && (
                        <p className="text-muted-foreground text-[10px]">
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit"
                          }).format(doc.uploadedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {documentsList.length > 0 && (onVerify || onReject || onRequestCorrection) && (
            <div className="flex gap-3 pt-4 border-t border-border">
              {onReject && (
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <XCircle className="w-4 h-4" />
                  Отклонить
                </Button>
              )}
              {onRequestCorrection && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setCorrectionDialogOpen(true)}
                >
                  <Edit className="w-4 h-4" />
                  Исправить
                </Button>
              )}
              {onVerify && (
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 gap-2"
                  onClick={() => {
                    onVerify();
                    onOpenChange(false);
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Одобрить
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог отклонения */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить верификацию</AlertDialogTitle>
            <AlertDialogDescription>
              Укажите причину отклонения. Водитель получит уведомление с этой причиной.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason" className="mb-2 block">
              Причина отклонения *
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="Например: Неразборчивое фото водительского удостоверения"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Отклонить верификацию
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог доработки */}
      <AlertDialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить на доработку</AlertDialogTitle>
            <AlertDialogDescription>
              Укажите, что нужно исправить. Водитель получит уведомление и сможет повторно загрузить документы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="correction-reason" className="mb-2 block">
              Что нужно исправить *
            </Label>
            <Textarea
              id="correction-reason"
              placeholder="Например: Пожалуйста, загрузите более четкое фото СТС"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCorrectionReason("")}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCorrectionConfirm}
              disabled={!correctionReason.trim()}
            >
              Отправить на доработку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Модальное окно для увеличенного просмотра изображения */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-7xl max-h-[95vh] p-0">
            <div className="relative w-full h-full flex items-center justify-center bg-black/90">
              <img
                src={selectedImage}
                alt="Увеличенное изображение"
                className="max-w-full max-h-[90vh] object-contain"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4"
                onClick={() => setSelectedImage(null)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DriverDocumentsDialog;
