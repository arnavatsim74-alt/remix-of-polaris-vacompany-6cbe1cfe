import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, CheckCircle, Circle, PlayCircle, ClipboardCheck, GraduationCap } from "lucide-react";
import { toast } from "sonner";

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
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {currentLesson.content || "No content available for this lesson."}
                </div>
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
