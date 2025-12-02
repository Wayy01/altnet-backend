"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  Loader2,
  Star,
  Trash2,
  ImagePlus,
  VideoIcon,
  LinkIcon,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ProductFormState, CreateImageData, CreateVideoData } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

/**
 * Section wrapper with staggered animation - defined outside component to prevent re-renders
 */
function Section({
  children,
  index,
  className,
  visible,
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4",
        className
      )}
      style={{
        transitionDelay: visible ? `${index * 100}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );
}

interface MediaTabProps {
  data: ProductFormState["media"];
  onChange: (updates: Partial<ProductFormState["media"]>) => void;
}

/**
 * Premium Media Tab with enhanced dropzone and image preview styling
 * Features drag-and-drop upload, image gallery with hover effects, and video management
 */
export function MediaTab({ data, onChange }: MediaTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation("products");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Image dropzone
  const onDropImages = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsUploadingImage(true);
      const newImages: CreateImageData[] = [];

      try {
        for (const file of acceptedFiles) {
          const response = await api.uploadImage(file);
          newImages.push({
            uuid: response.uuid,
            url: response.url,
            description: null,
          });
        }

        const updatedImages = [...data.images, ...newImages];
        onChange({ images: updatedImages });

        // Set first image as main if no main image
        if (!data.main_image_url && updatedImages.length > 0) {
          onChange({ main_image_url: updatedImages[0].url });
        }

        toast({
          title: t("toast.imagesUploaded"),
          description: t("toast.imagesUploadedDesc", { count: newImages.length }),
        });
      } catch (error) {
        toast({
          title: t("toast.uploadFailed"),
          description:
            error instanceof Error ? error.message : t("toast.uploadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsUploadingImage(false);
      }
    },
    [data.images, data.main_image_url, onChange, toast]
  );

  // Refs for manual file input triggering
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection from manual input
  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onDropImages(Array.from(files));
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onDropVideos(Array.from(files));
    }
    e.target.value = '';
  };

  const {
    getRootProps: getImageRootProps,
    getInputProps: getImageInputProps,
    isDragActive: isImageDragActive,
  } = useDropzone({
    onDrop: onDropImages,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploadingImage,
    noClick: true, // We handle click manually
    noKeyboard: true,
  });

  // Video dropzone
  const onDropVideos = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsUploadingVideo(true);
      const newVideos: CreateVideoData[] = [];

      try {
        for (const file of acceptedFiles) {
          const response = await api.uploadVideo(file);
          newVideos.push({
            uuid: response.uuid,
            url: response.url,
            title: file.name.replace(/\.[^.]+$/, ""),
            description: null,
            thumbnail_url: null,
          });
        }

        onChange({ videos: [...data.videos, ...newVideos] });

        toast({
          title: t("toast.videosUploaded"),
          description: t("toast.videosUploadedDesc", { count: newVideos.length }),
        });
      } catch (error) {
        toast({
          title: t("toast.uploadFailed"),
          description:
            error instanceof Error ? error.message : t("toast.uploadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsUploadingVideo(false);
      }
    },
    [data.videos, onChange, toast]
  );

  const {
    getRootProps: getVideoRootProps,
    getInputProps: getVideoInputProps,
    isDragActive: isVideoDragActive,
  } = useDropzone({
    onDrop: onDropVideos,
    accept: {
      "video/mp4": [".mp4"],
      "video/webm": [".webm"],
      "video/quicktime": [".mov"],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: isUploadingVideo,
    noClick: true, // We handle click manually
    noKeyboard: true,
  });

  // Remove handlers
  const removeImage = async (index: number) => {
    const image = data.images[index];
    try {
      await api.deleteUploadedImage(image.uuid);
    } catch {
      // Ignore delete errors
    }

    const updatedImages = data.images.filter((_, i) => i !== index);
    onChange({ images: updatedImages });

    // Update main image if removed
    if (data.main_image_url === image.url) {
      onChange({ main_image_url: updatedImages[0]?.url || "" });
    }
  };

  const removeVideo = async (index: number) => {
    const video = data.videos[index];
    try {
      await api.deleteUploadedVideo(video.uuid);
    } catch {
      // Ignore delete errors
    }

    onChange({ videos: data.videos.filter((_, i) => i !== index) });
  };

  const setAsMainImage = (url: string) => {
    onChange({ main_image_url: url });
  };

  return (
    <div className="space-y-8">
      {/* Images Section */}
      <Section index={0} visible={sectionsVisible}>
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <ImagePlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-semibold">{t("media.productImages")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("media.imageFormats")}
                </p>
              </div>
            </div>
            {data.images.length > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {data.images.length !== 1 ? t("media.imagesCountPlural", { count: data.images.length }) : t("media.imagesCount", { count: data.images.length })}
              </Badge>
            )}
          </div>

          {/* Image Dropzone */}
          {/* Hidden file input for click handling */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleImageInputChange}
            className="hidden"
          />
          <div
            {...getImageRootProps()}
            onClick={() => imageInputRef.current?.click()}
            className={cn(
              "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center",
              "transition-all duration-300 ease-out",
              isImageDragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
              isUploadingImage && "pointer-events-none opacity-50"
            )}
          >
            <input {...getImageInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {isUploadingImage ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t("media.uploadingImages")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("media.uploadingImagesHint")}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200",
                      isImageDragActive
                        ? "bg-primary/20"
                        : "bg-muted"
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-7 w-7 transition-colors duration-200",
                        isImageDragActive
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <p className="font-medium">
                      {isImageDragActive
                        ? t("media.dropImagesHere")
                        : t("media.dragDropImages")}
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t("media.orClickBrowse")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 pointer-events-none"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {t("media.browseFiles")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Image Preview Grid */}
          {data.images.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {data.images.map((image, index) => {
                const isMain = data.main_image_url === image.url;
                return (
                  <div
                    key={image.uuid}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all duration-200",
                      "hover:shadow-lg hover:-translate-y-1",
                      isMain
                        ? "border-primary ring-2 ring-primary/20 ring-offset-2"
                        : "border-border/50 hover:border-border"
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <img
                      src={image.url}
                      alt={image.description || `Image ${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    {/* Action Buttons */}
                    <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-lg backdrop-blur-sm transition-all duration-200",
                          "bg-white/90 hover:bg-white shadow-sm",
                          isMain && "bg-yellow-500/90 hover:bg-yellow-500 text-white"
                        )}
                        onClick={() => setAsMainImage(image.url)}
                        title={isMain ? t("media.mainImage") : t("media.setAsMain")}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            isMain && "fill-current"
                          )}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-lg backdrop-blur-sm bg-white/90 hover:bg-destructive hover:text-white shadow-sm transition-all duration-200"
                        onClick={() => removeImage(index)}
                        title={t("media.removeImage")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Main Image Badge */}
                    {isMain && (
                      <div className="absolute bottom-0 left-0 right-0 bg-primary px-2 py-1.5 text-center">
                        <span className="text-xs font-medium text-primary-foreground flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {t("media.mainImage")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* Videos Section */}
      <Section index={1} visible={sectionsVisible}>
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <VideoIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-semibold">{t("media.productVideos")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("media.videoFormats")}
                </p>
              </div>
            </div>
            {data.videos.length > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {data.videos.length !== 1 ? t("media.videosCountPlural", { count: data.videos.length }) : t("media.videosCount", { count: data.videos.length })}
              </Badge>
            )}
          </div>

          {/* Video Dropzone */}
          {/* Hidden file input for click handling */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            multiple
            onChange={handleVideoInputChange}
            className="hidden"
          />
          <div
            {...getVideoRootProps()}
            onClick={() => videoInputRef.current?.click()}
            className={cn(
              "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center",
              "transition-all duration-300 ease-out",
              isVideoDragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
              isUploadingVideo && "pointer-events-none opacity-50"
            )}
          >
            <input {...getVideoInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {isUploadingVideo ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t("media.uploadingVideos")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("media.uploadingVideosHint")}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200",
                      isVideoDragActive
                        ? "bg-primary/20"
                        : "bg-muted"
                    )}
                  >
                    <Video
                      className={cn(
                        "h-7 w-7 transition-colors duration-200",
                        isVideoDragActive
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <p className="font-medium">
                      {isVideoDragActive
                        ? t("media.dropVideosHere")
                        : t("media.dragDropVideos")}
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t("media.orClickBrowse")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 pointer-events-none"
                    >
                      <Video className="h-4 w-4" />
                      {t("media.browseFiles")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Video Preview List */}
          {data.videos.length > 0 && (
            <div className="space-y-3">
              {data.videos.map((video, index) => (
                <div
                  key={video.uuid}
                  className={cn(
                    "group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4",
                    "transition-all duration-200 hover:shadow-sm hover:border-border",
                    "animate-in fade-in-0 slide-in-from-bottom-2"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Video Thumbnail Placeholder */}
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                  {/* Video Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <Input
                      value={video.title || ""}
                      onChange={(e) => {
                        const updatedVideos = [...data.videos];
                        updatedVideos[index] = {
                          ...video,
                          title: e.target.value,
                        };
                        onChange({ videos: updatedVideos });
                      }}
                      placeholder={t("media.videoTitle")}
                      className={cn(
                        "h-9 rounded-lg transition-all duration-200",
                        "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        "hover:border-primary/50"
                      )}
                    />
                    <Input
                      value={video.description || ""}
                      onChange={(e) => {
                        const updatedVideos = [...data.videos];
                        updatedVideos[index] = {
                          ...video,
                          description: e.target.value,
                        };
                        onChange({ videos: updatedVideos });
                      }}
                      placeholder={t("media.videoDescription")}
                      className={cn(
                        "h-9 rounded-lg text-sm transition-all duration-200",
                        "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        "hover:border-primary/50"
                      )}
                    />
                  </div>
                  {/* Actions */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "shrink-0 h-9 w-9 rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    )}
                    onClick={() => removeVideo(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Main Image URL Override */}
      <Section index={2} visible={sectionsVisible}>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted border border-border/50">
              <LinkIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label htmlFor="main_image_url" className="text-sm font-medium">
                {t("media.mainImageUrl")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("media.mainImageUrlHint")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              id="main_image_url"
              placeholder={t("media.mainImageUrlPlaceholder")}
              value={data.main_image_url}
              onChange={(e) => onChange({ main_image_url: e.target.value })}
              className={cn(
                "h-11 rounded-lg font-mono text-sm transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            {data.main_image_url && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-lg transition-all duration-200 hover:bg-muted"
                onClick={() => window.open(data.main_image_url, "_blank")}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* Summary Stats */}
      {(data.images.length > 0 || data.videos.length > 0) && (
        <Section index={3} visible={sectionsVisible}>
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">{data.images.length}</p>
                <p className="text-xs text-muted-foreground">{t("media.images")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">{data.videos.length}</p>
                <p className="text-xs text-muted-foreground">{t("media.videos")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold tabular-nums">
                  {data.images.length + data.videos.length}
                </p>
                <p className="text-xs text-muted-foreground">{t("media.totalMedia")}</p>
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
