import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, CheckCircle, ArrowRight, Eye } from "lucide-react";

export default function Academy() {
  const { pilot } = useAuth();
  const navigate = useNavigate();
  const [selectedPractical, setSelectedPractical] = useState<any | null>(null);

  const formatPracticalNotes = (notes?: string | null) => {
    const text = String(notes || "").replaceAll("\\n", "\n").replace(/^Recruitment practical\s*/i, "").trim();
    if (!text) return "Practical assignment from recruitment flow";
    return text;
  };

  const { data: courses, isLoading } = useQuery({
    queryKey: ["academy-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academy_courses")
        .select("*")
        .eq("is_published", true)
        .order("sort_order");
      return data || [];
    },
  });


  const { data: standalonePracticals } = useQuery({
    queryKey: ["academy-standalone-practicals", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_practicals")
        .select("id, status, notes, scheduled_at, created_at")
        .eq("pilot_id", pilot.id)
        .is("course_id", null)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!pilot?.id,
  });
  const { data: standaloneExams } = useQuery({
    queryKey: ["academy-standalone-exams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academy_exams")
        .select("id, title, description, passing_score, max_attempts")
        .eq("is_published", true)
        .is("course_id", null)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["academy-enrollments", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_enrollments")
        .select("*")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const { data: modules } = useQuery({
    queryKey: ["academy-all-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_modules").select("id, course_id");
      return data || [];
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["academy-all-lessons"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_lessons").select("id, module_id");
      return data || [];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["academy-progress", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_lesson_progress")
        .select("lesson_id")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const getCourseProgress = (courseId: string) => {
    const courseModuleIds = modules?.filter(m => m.course_id === courseId).map(m => m.id) || [];
    const courseLessonIds = lessons?.filter(l => courseModuleIds.includes(l.module_id)).map(l => l.id) || [];
    const completedCount = progress?.filter(p => courseLessonIds.includes(p.lesson_id)).length || 0;
    const total = courseLessonIds.length;
    return total > 0 ? Math.round((completedCount / total) * 100) : 0;
  };

  const isEnrolled = (courseId: string) => enrollments?.some(e => e.course_id === courseId);
  const getEnrollment = (courseId: string) => enrollments?.find(e => e.course_id === courseId);

  const categoryLabels: Record<string, string> = {
    general: "General",
    initial_training: "Initial Training",
    recurrent: "Recurrent",
    specialty: "Specialty",
    type_rating: "Type Rating",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Crew Center Academy</h1>
          <p className="text-muted-foreground">Browse courses, take exams, and advance your career</p>
        </div>
      </div>

      {/* Enrolled Courses */}
      {enrollments && enrollments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {enrollments.map(enrollment => {
              const course = courses?.find(c => c.id === enrollment.course_id);
              if (!course) return null;
              const prog = getCourseProgress(course.id);
              return (
                <Card key={enrollment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/academy/course/${course.id}`)}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">{categoryLabels[course.category] || course.category}</Badge>
                      {enrollment.status === "completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <CardTitle className="text-sm line-clamp-1">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 px-4 pb-4">
                    <Progress value={prog} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{prog}%</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}


      {/* Standalone Practicals */}
      {standalonePracticals && standalonePracticals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">My Standalone Practicals</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {standalonePracticals.map((practical: any) => (
              <Card key={practical.id} className="overflow-hidden cursor-pointer" onClick={() => setSelectedPractical(practical)}>
                <CardHeader className="pt-4 px-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">Practical</Badge>
                    <Badge variant={practical.status === "passed" ? "default" : practical.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                      {practical.status || "scheduled"}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm">Standalone Practical</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">{formatPracticalNotes(practical.notes).split("\n")[0]}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2 text-xs text-muted-foreground">
                  <div>Assigned: {new Date(practical.created_at || practical.scheduled_at || Date.now()).toLocaleString()}</div>
                  {practical.scheduled_at && <div>Scheduled: {new Date(practical.scheduled_at).toLocaleString()}</div>}
                  <Button size="sm" variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); setSelectedPractical(practical); }}>
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <Dialog open={!!selectedPractical} onOpenChange={(open) => { if (!open) setSelectedPractical(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standalone Practical Details</DialogTitle>
          </DialogHeader>
          {selectedPractical && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Practical</Badge>
                <Badge variant={selectedPractical.status === "passed" ? "default" : selectedPractical.status === "failed" ? "destructive" : "secondary"}>
                  {selectedPractical.status || "scheduled"}
                </Badge>
              </div>
              <div className="rounded-md border p-3 bg-muted/40 whitespace-pre-wrap leading-relaxed">
                {formatPracticalNotes(selectedPractical.notes)}
              </div>
              <div className="text-xs text-muted-foreground">Assigned: {new Date(selectedPractical.created_at || selectedPractical.scheduled_at || Date.now()).toLocaleString()}</div>
              {selectedPractical.scheduled_at && <div className="text-xs text-muted-foreground">Scheduled: {new Date(selectedPractical.scheduled_at).toLocaleString()}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Standalone Exams */}
      {standaloneExams && standaloneExams.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Standalone Exams</h2>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {standaloneExams.map(exam => (
              <Card key={exam.id} className="overflow-hidden">
                <CardHeader className="pt-4 px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Exam</Badge>
                  </div>
                  <CardTitle className="text-sm">{exam.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">{exam.description || "Standalone academy exam"}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {exam.passing_score}% to pass · {exam.max_attempts} attempts
                  </div>
                  <Button className="w-full" size="sm" onClick={() => navigate(`/academy/exam/${exam.id}`)}>
                    Take Exam
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Courses */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Courses</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-60" />)}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {courses.map(course => {
              const enrolled = isEnrolled(course.id);
              return (
                <Card key={course.id} className="overflow-hidden">
                  <CardHeader className="pt-4 px-4 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{categoryLabels[course.category] || course.category}</Badge>
                      {course.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </div>
                    <CardTitle className="text-sm">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">{course.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Button
                      className="w-full"
                      size="sm"
                      variant={enrolled ? "outline" : "default"}
                      onClick={() => navigate(`/academy/course/${course.id}`)}
                    >
                      {enrolled ? "Continue" : "View Course"}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No courses available yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
