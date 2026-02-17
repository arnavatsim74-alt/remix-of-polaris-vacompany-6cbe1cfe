import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, CheckCircle, Circle, ClipboardCheck, GraduationCap, Plane, Calendar, CheckSquare, XCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { notifyAdmins, sendNotification } from "@/lib/notifications";

function renderSimpleMarkdown(markdown?: string | null) {
  const text = markdown || "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" class="rounded-md border my-3" />')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n/g, "<br />");


  return { __html: html || "No content available for this lesson." };
}

export default function AcademyCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const { pilot } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["academy-course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("academy_courses").select("*").eq("id", courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: modules } = useQuery({
    queryKey: ["academy-modules", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("academy_modules").select("*").eq("course_id", courseId!).order("sort_order");
      return data || [];
    },
    enabled: !!courseId,
  });

  const { data: lessons } = useQuery({
    queryKey: ["academy-lessons", courseId],
    queryFn: async () => {
      if (!modules?.length) return [];
      const moduleIds = modules.map(m => m.id);
      const { data } = await supabase.from("academy_lessons").select("*").in("module_id", moduleIds).order("sort_order");
      return data || [];
    },
    enabled: !!modules?.length,
  });

  const { data: progress } = useQuery({
    queryKey: ["academy-progress", pilot?.id, courseId],
    queryFn: async () => {
      if (!pilot?.id || !lessons?.length) return [];
      const lessonIds = lessons.map(l => l.id);
      const { data } = await supabase.from("academy_lesson_progress").select("lesson_id").eq("pilot_id", pilot.id).in("lesson_id", lessonIds);
      return data || [];
    },
    enabled: !!pilot?.id && !!lessons?.length,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["academy-enrollment", pilot?.id, courseId],
    queryFn: async () => {
      if (!pilot?.id) return null;
      const { data } = await supabase.from("academy_enrollments").select("*").eq("pilot_id", pilot.id).eq("course_id", courseId!).maybeSingle();
      return data;
    },
    enabled: !!pilot?.id && !!courseId,
  });

  const { data: exams } = useQuery({
    queryKey: ["academy-exams", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("academy_exams").select("*").eq("course_id", courseId!).eq("is_published", true);
      return data || [];
    },
    enabled: !!courseId,
  });

  // Fetch practicals assigned to this pilot for this course
  const { data: practicals } = useQuery({
    queryKey: ["academy-practicals-pilot", pilot?.id, courseId],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_practicals")
        .select("*, academy_courses(title)")
        .eq("pilot_id", pilot.id)
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!pilot?.id && !!courseId,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!pilot?.id || !courseId) throw new Error("Missing data");
      const { error } = await supabase.from("academy_enrollments").insert({ pilot_id: pilot.id, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["academy-enrollments"] });
      toast.success("Enrolled successfully!");
    },
    onError: () => toast.error("Failed to enroll"),
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!pilot?.id) throw new Error("No pilot");
      const { error } = await supabase.from("academy_lesson_progress").insert({ pilot_id: pilot.id, lesson_id: lessonId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-progress"] });
      toast.success("Lesson completed!");
    },
    onError: () => toast.error("Failed to mark complete"),
  });

  const isLessonComplete = (lessonId: string) => progress?.some(p => p.lesson_id === lessonId);
  const completedCount = progress?.length || 0;
  const totalLessons = lessons?.length || 0;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const currentLesson = lessons?.find(l => l.id === activeLesson);

  if (courseLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  if (!course) return <div className="text-center py-12 text-muted-foreground">Course not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/academy")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground">{course.description}</p>
        </div>
        {!enrollment && (
          <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
            <GraduationCap className="h-4 w-4 mr-2" />
            Enroll
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {enrollment && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{completedCount}/{totalLessons} lessons</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar - Modules & Lessons */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Course Content</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="multiple" defaultValue={modules?.map(m => m.id)} className="px-4 pb-4">
                {modules?.map(mod => (
                  <AccordionItem key={mod.id} value={mod.id}>
                    <AccordionTrigger className="text-sm font-medium py-2">{mod.title}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {lessons?.filter(l => l.module_id === mod.id).map(lesson => (
                          <button
                            key={lesson.id}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left transition-colors ${
                              activeLesson === lesson.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                            }`}
                            onClick={() => setActiveLesson(lesson.id)}
                          >
                            {isLessonComplete(lesson.id) ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="truncate">{lesson.title}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Exams */}
          {exams && exams.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Exams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {exams.map(exam => (
                  <Button
                    key={exam.id}
                    variant="outline"
                    className="w-full justify-start text-sm"
                    onClick={() => navigate(`/academy/exam/${exam.id}`)}
                  >
                    {exam.title}
                    <Badge variant="secondary" className="ml-auto">{exam.passing_score}% to pass</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Assigned Practicals */}
          {practicals && practicals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  Assigned Practicals
                </CardTitle>
              </CardHeader>
      <CardContent className="space-y-2">
                {practicals.map((p: any) => (
                  <PracticalCard key={p.id} practical={p} pilotId={pilot?.id} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Area */}
        <Card className="min-h-[400px]">
          {currentLesson ? (
            <>
              <CardHeader>
                <CardTitle>{currentLesson.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentLesson.video_url && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe src={currentLesson.video_url} className="w-full h-full" allowFullScreen />
                  </div>
                )}
                {(currentLesson as any).image_url && (
                  <div className="rounded-lg overflow-hidden border">
                    <img src={(currentLesson as any).image_url} alt={currentLesson.title} className="w-full h-auto object-contain max-h-[500px]" />
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={renderSimpleMarkdown(currentLesson.content)} />
                {enrollment && !isLessonComplete(currentLesson.id) && (
                  <Button onClick={() => markCompleteMutation.mutate(currentLesson.id)} disabled={markCompleteMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Complete
                  </Button>
                )}
                {isLessonComplete(currentLesson.id) && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" /> Completed
                  </Badge>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full py-20">
              <div className="text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a lesson to begin</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---- Practical Card with completion button ---- */
function PracticalCard({ practical: p, pilotId }: { practical: any; pilotId?: string }) {
  const [uploadingReplay, setUploadingReplay] = useState(false);
  const queryClient = useQueryClient();

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("academy_practicals").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", p.id);
      if (error) throw error;

      if (pilotId) {
        await sendNotification({
          recipientPilotId: pilotId,
          title: "Practical marked as completed",
          message: `You marked practical ${p.academy_courses?.title || ""} as completed and it is awaiting review.`,
          type: "practical_completion",
          relatedEntity: "academy_practical",
          relatedId: p.id,
        });
      }

      await notifyAdmins(
        "Practical completion submitted",
        `${p.academy_courses?.title || "A course"} practical was marked as completed by a pilot and is awaiting review.`,
        "practical_completion",
        "academy_practical",
        p.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-practicals-pilot"] });
      toast.success("Practical marked as completed!");
    },
    onError: () => toast.error("Failed to update practical"),
  });

  const handleReplayUpload = async (file?: File) => {
    if (!file || !pilotId) return;
    setUploadingReplay(true);
    try {
      const ext = file.name.split(".").pop() || "replay";
      const path = `practical-replays/${pilotId}/${p.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      const { error } = await supabase.from("academy_practicals").update({ replay_file_url: data.publicUrl }).eq("id", p.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["academy-practicals-pilot"] });
      toast.success("Replay uploaded");
    } catch {
      toast.error("Failed to upload replay file");
    } finally {
      setUploadingReplay(false);
    }
  };

  return (
    <div className="p-2 rounded-md border text-sm space-y-1">
      <div className="flex items-center justify-between">
        <Badge variant={p.status === "passed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
          {p.status}
        </Badge>
        {p.scheduled_at && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(p.scheduled_at).toLocaleDateString()}
          </span>
        )}
      </div>
      {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
      {p.result_notes && (
        <p className={`text-xs ${p.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {p.status === "failed" ? "Fail Reason" : "Result"}: {p.result_notes}
        </p>
      )}
            <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={uploadingReplay} asChild>
          <label>
            <Upload className="h-3 w-3 mr-1" /> Upload IF Replay
            <input type="file" className="hidden" accept=".ifrp,.replay,.txt" onChange={(e) => handleReplayUpload(e.target.files?.[0])} />
          </label>
        </Button>
        {p.replay_file_url && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
            <a href={p.replay_file_url} target="_blank" rel="noreferrer">View replay</a>
          </Button>
        )}
      </div>

      {p.status === "passed" && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3 w-3" /> Passed
        </div>
      )}
      {p.status === "failed" && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3 w-3" /> Failed
        </div>
      )}
      {p.status === "scheduled" && (
        <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => markCompleteMutation.mutate()} disabled={markCompleteMutation.isPending}>
          <CheckSquare className="h-3 w-3 mr-1" /> Mark as Completed
        </Button>
      )}
    </div>
  );
}
