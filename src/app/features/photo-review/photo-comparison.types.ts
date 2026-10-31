export interface AgeAndMaturationAssessment {
  readonly estimated_apparent_age_image_a: string;
  readonly estimated_apparent_age_image_b: string;
  readonly morphological_continuity: string;
  readonly maturation_observations: string;
}

export interface LandmarkRegionAnalysis {
  readonly congruence: 'HIGH' | 'MODERATE' | 'LOW' | string;
  readonly findings: string;
}

export interface SurfaceMarkers {
  readonly features_detected: boolean;
  readonly consistent_markers: readonly string[];
  readonly inconsistent_markers: readonly string[];
}

export interface LandmarkAnalysis {
  readonly orbit_and_interocular_region: LandmarkRegionAnalysis;
  readonly nasal_complex: LandmarkRegionAnalysis;
  readonly mandibular_and_perioral_region: LandmarkRegionAnalysis;
  readonly auricular_features: LandmarkRegionAnalysis;
  readonly surface_markers: SurfaceMarkers;
}

export interface ImagingLimitations {
  readonly image_a_clarity: string;
  readonly image_b_clarity: string;
  readonly perspective_or_lighting_distortions: string;
}

export interface PhotoComparisonResponse {
  readonly similarity_classification: 'HIGH_SIMILARITY' | 'MODERATE_SIMILARITY' | 'LOW_SIMILARITY' | string;
  readonly confidence_score: number;
  readonly estimated_match_percentage: number;
  readonly age_and_maturation_assessment: AgeAndMaturationAssessment;
  readonly landmark_analysis: LandmarkAnalysis;
  readonly imaging_limitations: ImagingLimitations;
  readonly distinguishing_differences: readonly string[];
  readonly technical_summary: string;
}
