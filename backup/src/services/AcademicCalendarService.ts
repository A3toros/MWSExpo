/**
 * Academic Calendar Service for React Native
 * 
 * Provides centralized academic calendar management using static JSON data.
 * Eliminates database queries for academic period detection.
 * 
 * Features:
 * - Load academic calendar from JSON file
 * - Get current term based on today's date
 * - Get current semester with all terms
 * - Term-based UI for teachers
 * - Automatic term detection for students
 */

interface AcademicTerm {
  id: number;
  academic_year: string;
  semester: number;
  term: number;
  start_date: string;
  end_date: string;
}

class AcademicCalendarService {
  private academicCalendar: AcademicTerm[] | null = null;
  private loaded = false;

  /**
   * Load academic calendar from JSON file
   * @returns {Promise<AcademicTerm[]>} Academic calendar data
   */
  async loadAcademicCalendar(): Promise<AcademicTerm[]> {
    if (this.loaded && this.academicCalendar) return this.academicCalendar;
    
    try {
      // Load from bundled JSON file
      const academicYearData = require('../../public/academic_year.json');
      
      if (!Array.isArray(academicYearData)) {
        throw new Error('Invalid academic calendar format');
      }
      
      this.academicCalendar = academicYearData;
      this.loaded = true;
      console.log('📅 Academic calendar loaded:', this.academicCalendar.length, 'terms');
      return this.academicCalendar;
    } catch (error) {
      console.error('📅 Error loading academic calendar:', error);
      return [];
    }
  }

  /**
   * Get current term based on today's date
   * @returns {AcademicTerm | null} Current term object or null
   */
  getCurrentTerm(): AcademicTerm | null {
    if (!this.academicCalendar) return null;
    
    const today = new Date();
    
    const currentTerm = this.academicCalendar.find(term => {
      const start = new Date(term.start_date);
      const end = new Date(term.end_date);
      return today >= start && today <= end;
    });
    
    return currentTerm || null;
  }

  /**
   * Get current academic period ID
   * @returns {number | null} Current academic period ID
   */
  getCurrentAcademicPeriodId(): number | null {
    const currentTerm = this.getCurrentTerm();
    return currentTerm?.id || null;
  }

  /**
   * Get current semester with all terms
   * @returns {Object | null} Current semester object with all terms
   */
  getCurrentSemester() {
    const currentTerm = this.getCurrentTerm();
    if (!currentTerm || !this.academicCalendar) return null;
    
    const semester = currentTerm.semester;
    // Restrict to the same academic year to avoid duplicating terms across years
    const allSemesterTerms = this.academicCalendar.filter(term => 
      term.semester === semester && term.academic_year === currentTerm.academic_year
    );
    
    return {
      semester,
      currentTerm,
      allTerms: allSemesterTerms
    };
  }

  /**
   * Get terms for a specific semester
   * @param {number} semester - Semester number (1 or 2)
   * @returns {AcademicTerm[]} Array of terms for the semester
   */
  getSemesterTerms(semester: number): AcademicTerm[] {
    if (!this.academicCalendar) return [];
    return this.academicCalendar.filter(term => term.semester === semester);
  }

  /**
   * Get terms for a specific academic year
   * @param {string} academicYear - Academic year (e.g., "2025-2026")
   * @returns {AcademicTerm[]} Array of terms for the academic year
   */
  getAcademicYearTerms(academicYear: string): AcademicTerm[] {
    if (!this.academicCalendar) return [];
    return this.academicCalendar.filter(term => term.academic_year === academicYear);
  }

  /**
   * Get term by ID
   * @param {number} termId - Term ID
   * @returns {AcademicTerm | null} Term object or null
   */
  getTermById(termId: number): AcademicTerm | null {
    if (!this.academicCalendar) return null;
    return this.academicCalendar.find(term => term.id === termId) || null;
  }

  /**
   * Check if a term is current
   * @param {number} termId - Term ID
   * @returns {boolean} True if term is current
   */
  isCurrentTerm(termId: number): boolean {
    const currentTerm = this.getCurrentTerm();
    return currentTerm?.id === termId;
  }

  /**
   * Get all academic years
   * @returns {string[]} Array of unique academic years
   */
  getAcademicYears(): string[] {
    if (!this.academicCalendar) return [];
    const years = [...new Set(this.academicCalendar.map(term => term.academic_year))];
    return years.sort();
  }
}

// Export singleton instance
export const academicCalendarService = new AcademicCalendarService();
export default academicCalendarService;