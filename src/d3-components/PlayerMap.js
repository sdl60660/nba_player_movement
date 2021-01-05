import * as d3 from "d3";
import * as topojson from "topojson-client";


class PlayerMap {

    containerEl;
    props;
    svg; 
  
    constructor(containerEl, props) {
        this.containerEl = containerEl;
        this.props = props;

        const { width, height, mapColor, geoData } = props;
        console.log(props);

        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        geoJSON.features = geoJSON.features.filter(d => !["Alaska", "Hawaii"].includes(d.properties.NAME));

        const projection = d3.geoAlbersUsa()
            .fitExtent([[20, 20], [width-20, height-20]], geoJSON);

        let path = d3.geoPath()
            .projection(projection);
        
        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);
                
        this.mapPath = this.svg.append("g")
            .attr("class", "neighborhood-path")
            .selectAll("path");
        
        this.mapPath = this.mapPath.data( geoJSON.features, d => d)
            .join(
                enter => enter.append("path")
                    .attr("d", path)
                    .attr("class", "state-path")
                    .style("opacity", 0.8)
                    .style("stroke","black")
                    .style('stroke-width', 0.5)
                    .style("fill", mapColor)

                // exit => exit.remove()
            );
      
      // init other vis elements like scales and axes here.
    }
    
    updateMapColor = ({ opacity, mapColor }) => { 
        this.mapPath
            // .transition()
            // .duration(300)
            .style("fill-opacity", opacity)
            .style("fill", mapColor);
    }
  
    resize = (width, height) => { /*...*/ }
    
  }
  
  export default PlayerMap;