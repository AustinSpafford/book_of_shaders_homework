// NondisplayedAuthor: Austin Spafford
// NondisplayedTitle: Sunflower Study

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

const float k_two_pi = 6.28318530718;

const float k_fermat_spiral_point_count = 100.0;

float random(
    vec2 st)
{
	return fract(
		sin(dot(st.xy, vec2(12.9898, 78.233))) * 
		43758.5453123);
}

vec3 sample_cell_color(
	float cell_index)
{
    return vec3(
        random(vec2(cell_index, 0.1)),
        random(vec2(cell_index, 0.2)),
        random(vec2(cell_index, 0.3)));
}

void sample_fermat_spiral_cells(
	vec2 st,
	float rotation_per_point,
	out float out_cell_strength_fraction,
	out float out_cell_index,
	out float out_neighbor_cell_index)
{
    float closest_distance_sq = 10000.0;
    float closest_point_index = 0.0;
    
    float next_closest_distance_sq = 10000.0;
    float next_closest_point_index = 0.0;
        
    for (float point_index = 0.0; 
         point_index < k_fermat_spiral_point_count;
         ++point_index)
    {
        vec2 polar_point = vec2(
            sqrt(point_index), // radius
            (point_index * rotation_per_point)); // theta
        
        vec2 point = (polar_point.x * vec2(cos(polar_point.y), sin(polar_point.y)));
        vec2 delta = (point - st);
        
        float distance_sq = dot(delta, delta);
        
        float case_new_closest_point = float(distance_sq < closest_distance_sq);
        float case_new_next_closest_point = (float(distance_sq < next_closest_distance_sq) - case_new_closest_point);
        float case_ignored_point = (1.0 - (case_new_closest_point + case_new_next_closest_point));
        
        // Update the next-closest-point.
        {
            // NOTE: When a new closest-point is selected, the previous closest-point is demoted to being next-closest.
            
            next_closest_distance_sq = (
                (case_new_closest_point * closest_distance_sq) +
                (case_new_next_closest_point * distance_sq) +
                (case_ignored_point * next_closest_distance_sq));

            next_closest_point_index = (
                (case_new_closest_point * closest_point_index) +
                (case_new_next_closest_point * point_index) +
                (case_ignored_point * next_closest_point_index));
        }
        
        // Update the closest-point.
        {
            closest_distance_sq = (
                (case_new_closest_point * distance_sq) +
                (case_new_next_closest_point * closest_distance_sq) +
                (case_ignored_point * closest_distance_sq));

            closest_point_index = (
                (case_new_closest_point * point_index) +
                (case_new_next_closest_point * closest_point_index) +
                (case_ignored_point * closest_point_index));
        }
    }
    
    float closest_distance = sqrt(closest_distance_sq);
    float next_closest_distance = sqrt(next_closest_distance_sq);
    
    float max_distance = ((closest_distance + next_closest_distance) * 0.5);
    
    out_cell_strength_fraction = (1.0 - (closest_distance / max_distance));
    out_cell_index = closest_point_index;
    out_neighbor_cell_index = next_closest_point_index;
}

vec3 sample_spiral_cell_strengths(
	vec2 st,
	float rotation_per_point)
{
    float cell_strength_fraction;
    float cell_index;
    float neighbor_cell_index;
	sample_fermat_spiral_cells(
		st,
		rotation_per_point,
		cell_strength_fraction,
		cell_index,
		neighbor_cell_index);
    
    return vec3(cell_strength_fraction);
}

vec3 sample_spiral_rainbow_crystals(
	vec2 st,
	float rotation_per_point)
{
    float cell_strength_fraction;
    float cell_index;
    float neighbor_cell_index;
	sample_fermat_spiral_cells(
		st,
		rotation_per_point,
		cell_strength_fraction,
		cell_index,
		neighbor_cell_index);
    
    vec3 cell_color = sample_cell_color(cell_index);
    vec3 neighbor_cell_color = sample_cell_color(neighbor_cell_index);
    
    vec3 border_color = mix(cell_color, neighbor_cell_color, 0.5);
    
    return mix(
        vec3(0.0),
        mix(border_color, cell_color, mix(0.0, 1.0, cell_strength_fraction)),
        cell_strength_fraction);
}

void main()
{
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    
    // Zoom-factor.
    st -= 0.5;
    st *= 10.0;
    
    // Aspect-ratio correction.
    st.x *= (u_resolution.x / u_resolution.y);
    
    float animation_fraction = fract(u_time * 0.001);
    
    vec3 color = sample_spiral_cell_strengths(st, (animation_fraction * k_two_pi));    
    //vec3 color = sample_spiral_rainbow_crystals(st, (animation_fraction * k_two_pi));
    
    gl_FragColor = vec4(color, 1.0);
}