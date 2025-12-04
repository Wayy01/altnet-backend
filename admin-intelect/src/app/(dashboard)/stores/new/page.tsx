"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store as StoreIcon,
  ArrowLeft,
  Save,
  Loader2,
  ChevronRight,
  MapPin,
  Map,
  Image as ImageIcon,
  Video,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { StoreInput } from "@/types/stores";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";

export default function NewStorePage() {
  const router = useRouter();
  const { t } = useTranslation("stores");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return t("form.nameRequired");
    }
    if (!address.trim()) {
      return t("form.addressRequired");
    }
    return null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const uploadPromises = Array.from(files).map((file) =>
        api.uploadImage(file)
      );
      const results = await Promise.all(uploadPromises);
      const newImageUrls = results.map((r) => r.url);
      setImages((prev) => [...prev, ...newImageUrls]);
      toast.success(t("toast.imagesUploaded").replace("{{count}}", String(results.length)));
    } catch (error) {
      console.error("Failed to upload images:", error);
      toast.error(t("toast.imageUploadError"));
    } finally {
      setIsUploadingImage(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingVideo(true);
    try {
      const file = files[0];
      const result = await api.uploadVideo(file);
      setVideos((prev) => [...prev, result.url]);
      toast.success(t("toast.videoUploaded"));
    } catch (error) {
      console.error("Failed to upload video:", error);
      toast.error(t("toast.videoUploadError"));
    } finally {
      setIsUploadingVideo(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: StoreInput = {
        name: name.trim(),
        address: address.trim(),
        google_maps_url: googleMapsUrl.trim() || null,
        images,
        videos,
        is_active: isActive,
      };

      const store = await api.createStore(payload);

      toast.success(t("toast.created"));
      router.push("/stores");
    } catch (error) {
      console.error("Failed to create store:", error);
      toast.error(error instanceof Error ? error.message : t("toast.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/stores"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("page.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{t("page.createTitle")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 transition-all duration-200 hover:scale-105">
              <StoreIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("page.createTitle")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("page.createDescription")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("form.basicInfo")}</h3>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("form.name")} <span className="text-destructive">{t("form.required")}</span>
                </Label>
                <div className="relative">
                  <StoreIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("form.namePlaceholder")}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">
                  {t("form.address")} <span className="text-destructive">{t("form.required")}</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("form.addressPlaceholder")}
                    rows={2}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleMapsUrl">{t("form.googleMapsUrl")}</Label>
                <div className="relative">
                  <Map className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="googleMapsUrl"
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder={t("form.googleMapsPlaceholder")}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {t("form.isActive")}
                </Label>
              </div>
            </div>

            {/* Media */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("form.media")}</h3>

              {/* Images */}
              <div className="space-y-2">
                <Label>{t("form.images")}</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploadingImage}
                    />
                    <label htmlFor="image-upload">
                      <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-all">
                        {isUploadingImage ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t("form.uploading")}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="h-8 w-8" />
                            <span className="text-sm">{t("form.clickToUploadImages")}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Store ${index + 1}`}
                            className="h-24 w-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setImages(images.filter((_, i) => i !== index))}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Videos */}
              <div className="space-y-2">
                <Label>{t("form.videos")}</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                      disabled={isUploadingVideo}
                    />
                    <label htmlFor="video-upload">
                      <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-all">
                        {isUploadingVideo ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t("form.uploading")}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Video className="h-8 w-8" />
                            <span className="text-sm">{t("form.clickToUploadVideo")}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {videos.length > 0 && (
                    <div className="space-y-2">
                      {videos.map((url, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-sm truncate">{url}</span>
                          <button
                            type="button"
                            onClick={() => setVideos(videos.filter((_, i) => i !== index))}
                            className="p-1 hover:bg-destructive/10 rounded"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.creating")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("actions.create")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
